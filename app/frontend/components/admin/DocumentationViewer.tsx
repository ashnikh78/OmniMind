import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
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
  Menu as MenuIcon,
  Bookmark as BookmarkIcon,
  Code as CodeIcon,
  Security as SecurityIcon,
  Architecture as ArchitectureIcon,
  NavigateNext as NavigateNextIcon,
  NavigateBefore as NavigateBeforeIcon,
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon,
  Print as PrintIcon,
  Download as DownloadIcon,
  Share as ShareIcon,
  PictureAsPdf as PdfIcon,
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';

interface TocItem {
  id: string;
  title: string;
  level: number;
}

interface DocumentationViewerProps {
  content: string;
  title: string;
  type: 'user-guide' | 'security' | 'api' | 'architecture';
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
  const [currentSection, setCurrentSection] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [tocItems, setTocItems] = useState<TocItem[]>([]);
  const [showToc, setShowToc] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const generateToc = useCallback(() => {
    if (contentRef.current) {
      const headings = contentRef.current.querySelectorAll('h1, h2, h3, h4, h5, h6');
      const items: TocItem[] = Array.from(headings).map((heading) => ({
        id: heading.id,
        title: heading.textContent || '',
        level: parseInt(heading.tagName[1]),
      }));
      setTocItems(items);
    }
  }, []);

  useEffect(() => {
    generateToc();
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

    if (contentRef.current) {
      const headings = contentRef.current.querySelectorAll('h1, h2, h3, h4, h5, h6');
      headings.forEach((heading) => observer.observe(heading));
    }

    return () => observer.disconnect();
  }, [content, generateToc]);

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
    if (contentRef.current && event.target.value) {
      const searchText = event.target.value.toLowerCase();
      const contentText = contentRef.current.textContent?.toLowerCase() || '';
      if (contentText.includes(searchText)) {
        const index = contentText.indexOf(searchText);
        contentRef.current.scrollTo({ top: index, behavior: 'smooth' });
      }
    }
  };

  const toggleDrawer = () => setIsDrawerOpen(!isDrawerOpen);

  const handleTocClick = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      if (isMobile) setIsDrawerOpen(false);
    }
  };

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    document.body.style.backgroundColor = isDarkMode ? '#ffffff' : '#121212';
  };

  const handlePrint = () => {
    window.print();
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
      setError('Failed to export PDF');
    }
  };

  const handleShare = async () => {
    try {
      await navigator.share({
        title,
        text: content.substring(0, 200) + '...',
        url: window.location.href,
      });
    } catch (error) {
      setError('Failed to share content');
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'user-guide': return <BookmarkIcon />;
      case 'security': return <SecurityIcon />;
      case 'api': return <CodeIcon />;
      case 'architecture': return <ArchitectureIcon />;
      default: return <BookmarkIcon />;
    }
  };

  return (
    <div className="flex h-screen">
      {isMobile && (
        <IconButton
          onClick={toggleDrawer}
          className="fixed top-4 left-4 z-50"
          aria-label="Toggle navigation drawer"
        >
          <MenuIcon />
        </IconButton>
      )}

      <Drawer
        variant={isMobile ? 'temporary' : 'permanent'}
        open={isMobile ? isDrawerOpen : true}
        onClose={toggleDrawer}
        classes={{ paper: 'w-72 p-4' }}
      >
        <div className="flex items-center mb-4">
          {getIcon()}
          <h2 className="ml-2 text-xl font-semibold">{title}</h2>
        </div>
        <div className="flex items-center mb-4">
          <IconButton onClick={() => setShowToc(!showToc)} aria-label="Toggle table of contents">
            <TocIcon />
          </IconButton>
          <span className="ml-2 text-sm">Table of Contents</span>
        </div>
        {showToc && (
          <div className="sticky top-4 max-h-[calc(100vh-100px)] overflow-auto p-2 bg-gray-50 rounded-lg shadow-sm">
            {tocItems.map((item) => (
              <div
                key={item.id}
                className={`pl-${item.level * 2} mb-2 cursor-pointer hover:text-blue-500 ${currentSection === item.id ? 'text-blue-600 font-bold' : ''}`}
                onClick={() => handleTocClick(item.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleTocClick(item.id)}
              >
                {item.title}
              </div>
            ))}
          </div>
        )}
      </Drawer>

      <main className={`flex-1 p-6 ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-black'} sm:ml-72`}>
        <div className="flex justify-between items-center mb-4">
          <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />}>
            <Link href="/admin" className="text-gray-500 hover:text-blue-500">Admin</Link>
            <Link href="/admin/help" className="text-gray-500 hover:text-blue-500">Help & Support</Link>
            <span>{title}</span>
          </Breadcrumbs>
          <div className="flex gap-2">
            <Tooltip title="Print">
              <IconButton onClick={handlePrint} aria-label="Print documentation">
                <PrintIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Export as PDF">
              <IconButton onClick={handleExportPdf} aria-label="Export as PDF">
                <PdfIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Share">
              <IconButton onClick={handleShare} aria-label="Share documentation">
                <ShareIcon />
              </IconButton>
            </Tooltip>
          </div>
        </div>

        <input
          type="text"
          placeholder="Search in documentation..."
          value={searchQuery}
          onChange={handleSearch}
          className="w-full p-2 mb-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {loading ? (
          <div className="flex justify-center p-6">
            <CircularProgress />
          </div>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          <div
            ref={contentRef}
            className={`p-6 rounded-lg shadow-sm ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-black'}`}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw, rehypeSanitize]}
              components={{
                code({ inline, className, children, ...props }) {
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
                h1: ({ children }) => (
                  <h1 className="mt-8 mb-4 text-3xl font-bold" id={String(children).toLowerCase().replace(/\s+/g, '-')}>
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="mt-6 mb-3 text-2xl font-semibold" id={String(children).toLowerCase().replace(/\s+/g, '-')}>
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="mt-4 mb-2 text-xl font-medium" id={String(children).toLowerCase().replace(/\s+/g, '-')}>
                    {children}
                  </h3>
                ),
                p: ({ children }) => (
                  <p className={`mb-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-800'}`}>
                    {children}
                  </p>
                ),
                a: ({ href, children }) => (
                  <a href={href} className={isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-500'}>
                    {children}
                  </a>
                ),
                img: ({ src, alt }) => (
                  <img src={src} alt={alt} className="max-w-full h-auto rounded-lg" />
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
      </main>

      <IconButton
        onClick={toggleTheme}
        className="fixed bottom-4 right-4 bg-white shadow-md"
        aria-label="Toggle theme"
      >
        {isDarkMode ? <LightModeIcon /> : <DarkModeIcon />}
      </IconButton>
    </div>
  );
};

export default DocumentationViewer;