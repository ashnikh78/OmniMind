import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Avatar,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Tooltip,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Sort as SortIcon,
  Favorite as FavoriteIcon,
  FavoriteBorder as FavoriteBorderIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { professionalPersonas } from '../data/professionalPersonas';
import type { Persona } from '../types/persona';
import { AIService } from '../services/aiService';

interface PersonaGalleryProps {
  onSelectPersona: (persona: Persona) => void;
}

const PersonaGallery: React.FC<PersonaGalleryProps> = ({ onSelectPersona }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recentlyUsed, setRecentlyUsed] = useState<string[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<Persona[]>([]);
  const aiService = new AIService(process.env.REACT_APP_API_URL || '', process.env.REACT_APP_API_KEY || '');

  useEffect(() => {
    // Load favorites and recently used from localStorage
    const savedFavorites = localStorage.getItem('favoritePersonas');
    const savedRecent = localStorage.getItem('recentlyUsedPersonas');
    if (savedFavorites) setFavorites(JSON.parse(savedFavorites));
    if (savedRecent) setRecentlyUsed(JSON.parse(savedRecent));
  }, []);

  useEffect(() => {
    // Get AI suggestions based on user's interaction history
    const getAiSuggestions = async () => {
      try {
        const suggestions = await aiService.generateSuggestions(
          JSON.stringify({ favorites, recentlyUsed })
        );
        const suggestedPersonas = professionalPersonas.filter((persona: Persona) =>
          suggestions.some((suggestion: string) => 
            persona.expertise.some((exp: string) => 
              suggestion.toLowerCase().includes(exp.toLowerCase())
            )
          )
        );
        setAiSuggestions(suggestedPersonas);
      } catch (error) {
        console.error('Error getting AI suggestions:', error);
      }
    };

    getAiSuggestions();
  }, [favorites, recentlyUsed]);

  const handlePersonaSelect = (persona: Persona) => {
    setSelectedPersona(persona);
    setShowDetails(true);
    
    // Update recently used
    const updatedRecent = [persona.id, ...recentlyUsed.filter(id => id !== persona.id)].slice(0, 5);
    setRecentlyUsed(updatedRecent);
    localStorage.setItem('recentlyUsedPersonas', JSON.stringify(updatedRecent));
  };

  const handleFavorite = (personaId: string) => {
    const updatedFavorites = favorites.includes(personaId)
      ? favorites.filter(id => id !== personaId)
      : [...favorites, personaId];
    setFavorites(updatedFavorites);
    localStorage.setItem('favoritePersonas', JSON.stringify(updatedFavorites));
  };

  const filteredPersonas = professionalPersonas.filter((persona: Persona) => {
    const matchesSearch = searchQuery === '' || 
      persona.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      persona.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      persona.expertise.some((exp: string) => exp.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = !selectedCategory || 
      persona.expertise.includes(selectedCategory);

    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(
    new Set(professionalPersonas.flatMap((p: Persona) => p.expertise))
  );

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          Professional Persona Gallery
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" align="center" paragraph>
          Choose from our curated collection of professional personas, each with unique expertise and communication styles
        </Typography>
      </Box>

      {/* Search and Filter Bar */}
      <Box sx={{ mb: 4, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          fullWidth={isMobile}
          variant="outlined"
          placeholder="Search personas..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
          }}
        />
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Filter by category">
            <IconButton onClick={() => setSelectedCategory(null)}>
              <FilterIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Sort by relevance">
            <IconButton>
              <SortIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Category Chips */}
      <Box sx={{ mb: 4, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {categories.map((category: string) => (
          <Chip
            key={category}
            label={category}
            onClick={() => setSelectedCategory(category)}
            color={selectedCategory === category ? 'primary' : 'default'}
            variant={selectedCategory === category ? 'filled' : 'outlined'}
          />
        ))}
      </Box>

      {/* AI Suggestions */}
      {aiSuggestions.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Recommended for You
          </Typography>
          <Grid container spacing={2}>
            {aiSuggestions.slice(0, 3).map((persona: Persona) => (
              <Grid item xs={12} sm={6} md={4} key={persona.id}>
                <Card
                  sx={{
                    cursor: 'pointer',
                    '&:hover': { transform: 'translateY(-4px)' },
                    transition: 'transform 0.2s',
                  }}
                  onClick={() => handlePersonaSelect(persona)}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Avatar src={persona.avatar} sx={{ mr: 2 }} />
                      <Box>
                        <Typography variant="h6">{persona.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {persona.expertise[0]}
                        </Typography>
                      </Box>
                    </Box>
                    <Typography variant="body2" paragraph>
                      {persona.description}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {persona.expertise.slice(0, 3).map((skill: string) => (
                        <Chip
                          key={skill}
                          label={skill}
                          size="small"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Persona Grid */}
      <Grid container spacing={3}>
        {filteredPersonas.map((persona: Persona) => (
          <Grid item xs={12} sm={6} md={4} key={persona.id}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer',
                  '&:hover': { transform: 'translateY(-4px)' },
                  transition: 'transform 0.2s',
                }}
                onClick={() => handlePersonaSelect(persona)}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar src={persona.avatar} sx={{ mr: 2 }} />
                    <Box>
                      <Typography variant="h6">{persona.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {persona.expertise[0]}
                      </Typography>
                    </Box>
                    <IconButton
                      sx={{ ml: 'auto' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFavorite(persona.id);
                      }}
                    >
                      {favorites.includes(persona.id) ? (
                        <FavoriteIcon color="error" />
                      ) : (
                        <FavoriteBorderIcon />
                      )}
                    </IconButton>
                  </Box>
                  <Typography variant="body2" paragraph>
                    {persona.description}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {persona.expertise.slice(0, 3).map((skill: string) => (
                      <Chip
                        key={skill}
                        label={skill}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>
        ))}
      </Grid>

      {/* Persona Details Dialog */}
      <Dialog
        open={showDetails}
        onClose={() => setShowDetails(false)}
        maxWidth="md"
        fullWidth
      >
        {selectedPersona && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Avatar src={selectedPersona.avatar} sx={{ mr: 2 }} />
                <Typography variant="h6">{selectedPersona.name}</Typography>
              </Box>
            </DialogTitle>
            <DialogContent>
              <Typography variant="body1" paragraph>
                {selectedPersona.description}
              </Typography>
              <Typography variant="h6" gutterBottom>
                Expertise
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                {selectedPersona.expertise.map((skill: string) => (
                  <Chip key={skill} label={skill} color="primary" />
                ))}
              </Box>
              <Typography variant="h6" gutterBottom>
                Specialties
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                {selectedPersona.specialties.map((specialty: string) => (
                  <Chip key={specialty} label={specialty} variant="outlined" />
                ))}
              </Box>
              <Typography variant="h6" gutterBottom>
                Communication Style
              </Typography>
              <Typography variant="body1" paragraph>
                {selectedPersona.communicationStyle}
              </Typography>
              {selectedPersona.tools && (
                <>
                  <Typography variant="h6" gutterBottom>
                    Available Tools
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {selectedPersona.tools.map((tool: string) => (
                      <Chip key={tool} label={tool} color="secondary" />
                    ))}
                  </Box>
                </>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setShowDetails(false)}>Close</Button>
              <Button
                variant="contained"
                color="primary"
                onClick={() => {
                  onSelectPersona(selectedPersona);
                  setShowDetails(false);
                }}
              >
                Select Persona
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Container>
  );
};

export default PersonaGallery; 