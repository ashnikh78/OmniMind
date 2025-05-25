import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  IconButton,
  Drawer,
  useTheme,
  useMediaQuery,
  Tooltip,
  Breadcrumbs,
  Link,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Search as SearchIcon,
  Menu as MenuIcon,
  Bookmark as BookmarkIcon,
  Code as CodeIcon,
  Security as SecurityIcon,
  Architecture as ArchitectureIcon,
  NavigateNext as NavigateNextIcon,
  NavigateBefore as NavigateBeforeIcon,
  Home as HomeIcon,
  Toc as TocIcon,
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon,
  Print as PrintIcon,
  Download as DownloadIcon,
  Share as ShareIcon,
  PictureAsPdf as PdfIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  height: '100%',
  overflow: 'auto',
  '& pre': {
    margin: theme.spacing(2, 0),
    borderRadius: theme.spacing(1),
  },
  '& code': {
    fontFamily: 'monospace',
  },
  '& img': {
    maxWidth: '100%',
    height: 'auto',
    borderRadius: theme.spacing(1),
  },
  '& table': {
    width: '100%',
    borderCollapse: 'collapse',
    margin: theme.spacing(2, 0),
  },
  '& th, & td': {
    border: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(1),
  },
  '& th': {
    backgroundColor: theme.palette.background.default,
  },
}));

const SearchBar = styled(TextField)(({ theme }) => ({
  marginBottom: theme.spacing(3),
  '& .MuiOutlinedInput-root': {
    borderRadius: theme.spacing(1),
  },
}));

const NavigationDrawer = styled(Drawer)(({ theme }) => ({
  width: 280,
  flexShrink: 0,
  '& .MuiDrawer-paper': {
    width: 280,
    boxSizing: 'border-box',
    padding: theme.spacing(2),
  },
}));

const NavigationControls = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: theme.spacing(2),
}));

const TableOfContents = styled(Box)(({ theme }) => ({
  position: 'sticky',
  top: theme.spacing(2),
  maxHeight: 'calc(100vh - 100px)',
  overflow: 'auto',
  padding: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.spacing(1),
  boxShadow: theme.shadows[1],
}));

const TocItem = styled(Box)<{ level: number }>(({ theme, level }) => ({
  paddingLeft: theme.spacing(level * 2),
  marginBottom: theme.spacing(1),
  cursor: 'pointer',
  '&:hover': {
    color: theme.palette.primary.main,
  },
}));

const ThemeToggle = styled(IconButton)(({ theme }) => ({
  position: 'fixed',
  bottom: theme.spacing(2),
  right: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
  boxShadow: theme.shadows[2],
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
}));

const ActionBar = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(1),
  marginBottom: theme.spacing(2),
  '& .MuiIconButton-root': {
    backgroundColor: theme.palette.background.paper,
    boxShadow: theme.shadows[1],
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
}));

interface DocumentationViewerProps {
  content: string;
  title: string;
  type: 'user-guide' | 'security' | 'api' | 'architecture';
}

interface TocItem {
  id: string;
  title: string;
  level: number;
}

const DocumentationViewer: React.FC<DocumentationViewerProps> = ({
  content,
  title,
  type,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSection, setCurrentSection] = useState<string>('');
  const contentRef = useRef<HTMLDivElement>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [tocItems, setTocItems] = useState<TocItem[]>([]);
  const [showToc, setShowToc] = useState(true);
  const [isPrintMode, setIsPrintMode] = useState(false);

  useEffect(() => {
    if (contentRef.current) {
      const headings = contentRef.current.querySelectorAll('h1, h2, h3, h4, h5, h6');
      const items: TocItem[] = Array.from(headings).map((heading) => ({
        id: heading.id,
        title: heading.textContent || '',
        level: parseInt(heading.tagName[1]),
      }));
      setTocItems(items);

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setCurrentSection(entry.target.id);
            }
          });
        },
        { threshold: 0.5 }
      );

      headings.forEach((heading) => observer.observe(heading));
      return () => observer.disconnect();
    }
  }, [content]);

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
    if (contentRef.current) {
      const searchText = event.target.value.toLowerCase();
      const content = contentRef.current.textContent?.toLowerCase() || '';
      if (content.includes(searchText)) {
        const index = content.indexOf(searchText);
        contentRef.current.scrollTo({
          top: index,
          behavior: 'smooth',
        });
      }
    }
  };

  const toggleDrawer = () => {
    setIsDrawerOpen(!isDrawerOpen);
  };

  const getIcon = () => {
    switch (type) {
      case 'user-guide':
        return <BookmarkIcon />;
      case 'security':
        return <SecurityIcon />;
      case 'api':
        return <CodeIcon />;
      case 'architecture':
        return <ArchitectureIcon />;
      default:
        return <BookmarkIcon />;
    }
  };

  const navigationItems = [
    {
      title: 'Overview',
      path: '#overview',
    },
    {
      title: 'Getting Started',
      path: '#getting-started',
    },
    {
      title: 'Features',
      path: '#features',
    },
    {
      title: 'Best Practices',
      path: '#best-practices',
    },
    {
      title: 'Troubleshooting',
      path: '#troubleshooting',
    },
  ];

  const handleScrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      if (isMobile) {
        setIsDrawerOpen(false);
      }
    }
  };

  const handleTocClick = (id: string) => {
    handleScrollToSection(id);
  };

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    document.body.style.backgroundColor = isDarkMode ? '#ffffff' : '#121212';
  };

  const handlePrint = () => {
    setIsPrintMode(true);
    setTimeout(() => {
      window.print();
      setIsPrintMode(false);
    }, 100);
  };

  const handleExportPdf = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      const content = document.querySelector('.markdown-content')?.textContent || '';
      
      doc.setFontSize(12);
      doc.text(title, 20, 20);
      doc.setFontSize(10);
      doc.text(content, 20, 30, { maxWidth: 170 });
      
      doc.save(`${title.toLowerCase().replace(/\s+/g, '-')}.pdf`);
    } catch (error) {
      console.error('Failed to export PDF:', error);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.share({
        title: title,
        text: content.substring(0, 200) + '...',
        url: window.location.href,
      });
    } catch (error) {
      console.error('Failed to share:', error);
    }
  };

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <Box sx={{ display: 'flex', height: '100%' }}>
      {isMobile && (
        <IconButton
          onClick={toggleDrawer}
          sx={{ position: 'fixed', top: 16, left: 16, zIndex: 1200 }}
        >
          <MenuIcon />
        </IconButton>
      )}

      <NavigationDrawer
        variant={isMobile ? 'temporary' : 'permanent'}
        open={isMobile ? isDrawerOpen : true}
        onClose={toggleDrawer}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          {getIcon()}
          <Typography variant="h6" sx={{ ml: 1 }}>
            {title}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <IconButton onClick={() => setShowToc(!showToc)}>
            <TocIcon />
          </IconButton>
          <Typography variant="subtitle2" sx={{ ml: 1 }}>
            Table of Contents
          </Typography>
        </Box>
        {showToc && (
          <TableOfContents>
            {tocItems.map((item) => (
              <TocItem
                key={item.id}
                level={item.level}
                onClick={() => handleTocClick(item.id)}
                sx={{
                  color: currentSection === item.id ? 'primary.main' : 'text.primary',
                  fontWeight: currentSection === item.id ? 'bold' : 'normal',
                }}
              >
                {item.title}
              </TocItem>
            ))}
          </TableOfContents>
        )}
      </NavigationDrawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - 280px)` },
          ml: { sm: '280px' },
          backgroundColor: isDarkMode ? '#121212' : '#ffffff',
          color: isDarkMode ? '#ffffff' : '#000000',
          '@media print': {
            ml: 0,
            width: '100%',
            p: 0,
          },
        }}
      >
        <NavigationControls>
          <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />}>
            <Link color="inherit" href="/admin">
              Admin
            </Link>
            <Link color="inherit" href="/admin/help">
              Help & Support
            </Link>
            <Typography color="text.primary">{title}</Typography>
          </Breadcrumbs>
          <ActionBar>
            <Tooltip title="Print">
              <IconButton onClick={handlePrint}>
                <PrintIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Export as PDF">
              <IconButton onClick={handleExportPdf}>
                <PdfIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Share">
              <IconButton onClick={handleShare}>
                <ShareIcon />
              </IconButton>
            </Tooltip>
          </ActionBar>
          <Box>
            <Tooltip title="Previous Section">
              <IconButton
                onClick={() => {
                  const currentIndex = navigationItems.findIndex(
                    (item) => item.path.substring(1) === currentSection
                  );
                  if (currentIndex > 0) {
                    handleScrollToSection(
                      navigationItems[currentIndex - 1].path.substring(1)
                    );
                  }
                }}
              >
                <NavigateBeforeIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Next Section">
              <IconButton
                onClick={() => {
                  const currentIndex = navigationItems.findIndex(
                    (item) => item.path.substring(1) === currentSection
                  );
                  if (currentIndex < navigationItems.length - 1) {
                    handleScrollToSection(
                      navigationItems[currentIndex + 1].path.substring(1)
                    );
                  }
                }}
              >
                <NavigateNextIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </NavigationControls>

        <SearchBar
          fullWidth
          placeholder="Search in documentation..."
          value={searchQuery}
          onChange={handleSearch}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          <StyledPaper
            ref={contentRef}
            sx={{
              backgroundColor: isDarkMode ? '#1e1e1e' : '#ffffff',
              color: isDarkMode ? '#ffffff' : '#000000',
              '@media print': {
                boxShadow: 'none',
                backgroundColor: '#ffffff',
                color: '#000000',
              },
            }}
            className="markdown-content"
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw, rehypeSanitize]}
              components={{
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  return !inline && match ? (
                    <SyntaxHighlighter
                      style={isDarkMode ? vscDarkPlus : undefined}
                      language={match[1]}
                      PreTag="div"
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code
                      className={className}
                      style={{
                        backgroundColor: isDarkMode ? '#2d2d2d' : '#f5f5f5',
                        color: isDarkMode ? '#ffffff' : '#000000',
                      }}
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
                h1: ({ node, ...props }) => (
                  <Typography
                    variant="h3"
                    component="h1"
                    id={props.children?.toString().toLowerCase().replace(/\s+/g, '-')}
                    sx={{ mt: 4, mb: 2 }}
                    {...props}
                  />
                ),
                h2: ({ node, ...props }) => (
                  <Typography
                    variant="h4"
                    component="h2"
                    id={props.children?.toString().toLowerCase().replace(/\s+/g, '-')}
                    sx={{ mt: 3, mb: 2 }}
                    {...props}
                  />
                ),
                h3: ({ node, ...props }) => (
                  <Typography
                    variant="h5"
                    component="h3"
                    id={props.children?.toString().toLowerCase().replace(/\s+/g, '-')}
                    sx={{ mt: 2, mb: 1 }}
                    {...props}
                  />
                ),
                p: ({ node, ...props }) => (
                  <Typography
                    variant="body1"
                    sx={{
                      color: isDarkMode ? '#e0e0e0' : '#000000',
                      mb: 2,
                    }}
                    {...props}
                  />
                ),
                a: ({ node, ...props }) => (
                  <Link
                    {...props}
                    sx={{
                      color: isDarkMode ? '#90caf9' : '#1976d2',
                      '&:hover': {
                        color: isDarkMode ? '#bbdefb' : '#1565c0',
                      },
                    }}
                  />
                ),
                img: ({ node, ...props }) => (
                  <img
                    {...props}
                    style={{
                      maxWidth: '100%',
                      height: 'auto',
                      '@media print': {
                        maxWidth: '500px',
                      },
                    }}
                  />
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          </StyledPaper>
        )}
      </Box>

      <ThemeToggle onClick={toggleTheme} aria-label="toggle theme">
        {isDarkMode ? <LightModeIcon /> : <DarkModeIcon />}
      </ThemeToggle>
    </Box>
  );
};

export default DocumentationViewer; 