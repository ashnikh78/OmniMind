import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Breadcrumbs,
  Link,
  useTheme,
  CircularProgress,
  Alert,
  Snackbar,
  Button,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  Book as BookIcon,
  Security as SecurityIcon,
  Api as ApiIcon,
  Architecture as ArchitectureIcon,
  Help as HelpIcon,
  Search as SearchIcon,
  Bookmark as BookmarkIcon,
  Share as ShareIcon,
  Print as PrintIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { documentationService, DocumentationSection } from '../../services/documentationService';
import DocumentationViewer from './DocumentationViewer';

// Styled components
const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  marginBottom: theme.spacing(3),
  borderRadius: theme.spacing(1),
  boxShadow: theme.shadows[2],
}));

const StyledTabs = styled(Tabs)(({ theme }) => ({
  borderBottom: `1px solid ${theme.palette.divider}`,
  marginBottom: theme.spacing(3),
}));

const StyledTab = styled(Tab)(({ theme }) => ({
  textTransform: 'none',
  minWidth: 0,
  marginRight: theme.spacing(4),
}));

const DocumentationContent = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  '& h1': {
    marginBottom: theme.spacing(3),
  },
  '& h2': {
    marginTop: theme.spacing(4),
    marginBottom: theme.spacing(2),
  },
  '& h3': {
    marginTop: theme.spacing(3),
    marginBottom: theme.spacing(1),
  },
  '& ul, & ol': {
    paddingLeft: theme.spacing(4),
  },
  '& li': {
    marginBottom: theme.spacing(1),
  },
}));

const ActionBar = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: theme.spacing(2),
  marginBottom: theme.spacing(2),
}));

const LoadingContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '200px',
}));

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`doc-tabpanel-${index}`}
      aria-labelledby={`doc-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const HelpSupport: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState(0);
  const [sections, setSections] = useState<DocumentationSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<DocumentationSection | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotification, setShowNotification] = useState(false);
  const theme = useTheme();

  useEffect(() => {
    loadDocumentation();
  }, []);

  const loadDocumentation = async () => {
    try {
      setLoading(true);
      const data = await documentationService.getDocumentationSections();
      setSections(data);
      setError(null);
    } catch (err) {
      setError('Failed to load documentation. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setSelectedTab(newValue);
    setSelectedSection(null);
  };

  const handleSectionClick = async (section: DocumentationSection) => {
    try {
      setLoading(true);
      const content = await documentationService.getDocumentationContent(section.id);
      setSelectedSection({ ...section, content });
    } catch (err) {
      setError('Failed to load section content. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    if (query.length < 2) return;
    try {
      setLoading(true);
      const results = await documentationService.searchDocumentation(query);
      setSections(results);
    } catch (err) {
      setError('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    if (!selectedSection) return;
    const blob = new Blob([selectedSection.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedSection.title.toLowerCase().replace(/\s+/g, '-')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    if (!selectedSection) return;
    try {
      await navigator.share({
        title: selectedSection.title,
        text: selectedSection.content.substring(0, 200) + '...',
        url: window.location.href,
      });
    } catch (err) {
      setShowNotification(true);
    }
  };

  const documentationSections = [
    {
      title: 'User Guide',
      icon: <HelpIcon />,
      content: 'user-guide',
    },
    {
      title: 'Security',
      icon: <SecurityIcon />,
      content: 'security',
    },
    {
      title: 'API Reference',
      icon: <ApiIcon />,
      content: 'api',
    },
    {
      title: 'Architecture',
      icon: <ArchitectureIcon />,
      content: 'architecture',
    },
  ];

  if (loading) {
    return (
      <LoadingContainer>
        <CircularProgress />
      </LoadingContainer>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Breadcrumbs sx={{ mb: 3 }}>
        <Link color="inherit" href="/admin">
          Admin
        </Link>
        <Typography color="text.primary">Help & Support</Typography>
      </Breadcrumbs>

      <Typography variant="h4" component="h1" gutterBottom>
        Help & Support Documentation
      </Typography>

      <StyledPaper>
        <ActionBar>
          <Tooltip title="Print Documentation">
            <IconButton onClick={handlePrint}>
              <PrintIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Download as Markdown">
            <IconButton onClick={handleDownload} disabled={!selectedSection}>
              <DownloadIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Share Documentation">
            <IconButton onClick={handleShare} disabled={!selectedSection}>
              <ShareIcon />
            </IconButton>
          </Tooltip>
        </ActionBar>

        <StyledTabs
          value={selectedTab}
          onChange={handleTabChange}
          aria-label="documentation tabs"
        >
          {documentationSections.map((section, index) => (
            <StyledTab
              key={section.title}
              icon={section.icon}
              label={section.title}
              id={`doc-tab-${index}`}
              aria-controls={`doc-tabpanel-${index}`}
            />
          ))}
        </StyledTabs>

        {selectedSection ? (
          <DocumentationViewer
            content={selectedSection.content}
            title={selectedSection.title}
            type={selectedSection.type as any}
          />
        ) : (
          documentationSections.map((section, index) => (
            <TabPanel key={section.title} value={selectedTab} index={index}>
              <DocumentationContent>
                <Typography variant="h5" gutterBottom>
                  {section.title}
                </Typography>
                <List>
                  {sections
                    .filter((s) => s.type === section.content)
                    .map((docSection) => (
                      <React.Fragment key={docSection.id}>
                        <ListItem
                          button
                          onClick={() => handleSectionClick(docSection)}
                        >
                          <ListItemIcon>
                            {section.icon}
                          </ListItemIcon>
                          <ListItemText
                            primary={docSection.title}
                            secondary={`Click to view ${docSection.title.toLowerCase()} documentation`}
                          />
                        </ListItem>
                        <Divider />
                      </React.Fragment>
                    ))}
                </List>
              </DocumentationContent>
            </TabPanel>
          ))
        )}
      </StyledPaper>

      <Snackbar
        open={showNotification}
        autoHideDuration={6000}
        onClose={() => setShowNotification(false)}
        message="Sharing is not supported on this device"
      />
    </Container>
  );
};

export default HelpSupport; 