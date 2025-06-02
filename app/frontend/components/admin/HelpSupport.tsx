import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Breadcrumbs,
  Link,
  CircularProgress,
  Alert,
  Snackbar,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Book as BookIcon,
  Security as SecurityIcon,
  Api as ApiIcon,
  Architecture as ArchitectureIcon,
  Print as PrintIcon,
  Download as DownloadIcon,
  Share as ShareIcon,
} from '@mui/icons-material';
import { debounce } from 'lodash';
import DocumentationViewer from './DocumentationViewer';

interface DocumentationSection {
  id: string;
  title: string;
  type: 'user-guide' | 'security' | 'api' | 'architecture';
  content: string;
}

const documentationService = {
  getDocumentationSections: async (): Promise<DocumentationSection[]> => {
    // Mock implementation; replace with actual API call
    return [
      { id: '1', title: 'User Guide Overview', type: 'user-guide', content: '' },
      { id: '2', title: 'Security Policies', type: 'security', content: '' },
    ];
  },
  getDocumentationContent: async (id: string): Promise<string> => {
    // Mock implementation; replace with actual API call
    return '# Sample Content';
  },
  searchDocumentation: async (query: string): Promise<DocumentationSection[]> => {
    // Mock implementation; replace with actual API call
    return [];
  },
};

const HelpSupport: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState(0);
  const [sections, setSections] = useState<DocumentationSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<DocumentationSection | null>(null);
  const [showNotification, setShowNotification] = useState(false);

  const loadDocumentation = useCallback(async () => {
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
  }, []);

  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
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
    }, 300),
    []
  );

  useEffect(() => {
    loadDocumentation();
  }, [loadDocumentation]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
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

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
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
    { title: 'User Guide', icon: <BookIcon />, content: 'user-guide' },
    { title: 'Security', icon: <SecurityIcon />, content: 'security' },
    { title: 'API Reference', icon: <ApiIcon />, content: 'api' },
    { title: 'Architecture', icon: <ArchitectureIcon />, content: 'architecture' },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <CircularProgress />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto mt-8 mb-8">
        <Alert severity="error">{error}</Alert>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto mt-8 mb-8">
      <Breadcrumbs className="mb-6">
        <Link href="/admin" className="text-gray-500 hover:text-blue-500">Admin</Link>
        <span>Help & Support</span>
      </Breadcrumbs>

      <h1 className="text-3xl font-bold mb-6">Help & Support Documentation</h1>

      <div className="p-6 bg-white rounded-lg shadow-md">
        <div className="flex justify-end gap-4 mb-4">
          <Tooltip title="Print Documentation">
            <IconButton onClick={handlePrint} aria-label="Print documentation">
              <PrintIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Download as Markdown">
            <IconButton onClick={handleDownload} disabled={!selectedSection} aria-label="Download documentation">
              <DownloadIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Share Documentation">
            <IconButton onClick={handleShare} disabled={!selectedSection} aria-label="Share documentation">
              <ShareIcon />
            </IconButton>
          </Tooltip>
        </div>

        <div className="flex border-b mb-6">
          {documentationSections.map((section, index) => (
            <button
              key={section.title}
              onClick={() => handleTabChange({} as any, index)}
              className={`flex items-center px-4 py-2 mr-4 ${selectedTab === index ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-600'}`}
              aria-selected={selectedTab === index}
              role="tab"
            >
              {section.icon}
              <span className="ml-2">{section.title}</span>
            </button>
          ))}
        </div>

        {selectedSection ? (
          <DocumentationViewer
            content={selectedSection.content}
            title={selectedSection.title}
            type={selectedSection.type}
          />
        ) : (
          documentationSections.map((section, index) => (
            <div key={section.title} role="tabpanel" hidden={selectedTab !== index}>
              {selectedTab === index && (
                <div className="p-4">
                  <h2 className="text-2xl font-semibold mb-4">{section.title}</h2>
                  <ul className="space-y-2">
                    {sections
                      .filter((s) => s.type === section.content)
                      .map((docSection) => (
                        <li
                          key={docSection.id}
                          className="flex items-center p-2 hover:bg-gray-100 rounded cursor-pointer"
                          onClick={() => handleSectionClick(docSection)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => e.key === 'Enter' && handleSectionClick(docSection)}
                        >
                          {section.icon}
                          <div className="ml-4">
                            <h3 className="text-lg font-medium">{docSection.title}</h3>
                            <p className="text-sm text-gray-500">
                              Click to view {docSection.title.toLowerCase()} documentation
                            </p>
                          </div>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <Snackbar
        open={showNotification}
        autoHideDuration={6000}
        onClose={() => setShowNotification(false)}
        message="Sharing is not supported on this device"
      />
    </div>
  );
};

export default HelpSupport;