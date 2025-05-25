import axios from 'axios';

export interface DocumentationSection {
  id: string;
  title: string;
  content: string;
  type: 'user-guide' | 'security' | 'api' | 'architecture';
  order: number;
}

class DocumentationService {
  private baseUrl = '/api/v1/documentation';

  async getDocumentationSections(): Promise<DocumentationSection[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/sections`);
      return response.data;
    } catch (error) {
      console.error('Error fetching documentation sections:', error);
      throw error;
    }
  }

  async getDocumentationContent(sectionId: string): Promise<string> {
    try {
      const response = await axios.get(`${this.baseUrl}/content/${sectionId}`);
      return response.data.content;
    } catch (error) {
      console.error('Error fetching documentation content:', error);
      throw error;
    }
  }

  async searchDocumentation(query: string): Promise<DocumentationSection[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/search`, {
        params: { query },
      });
      return response.data;
    } catch (error) {
      console.error('Error searching documentation:', error);
      throw error;
    }
  }

  async getDocumentationByType(type: string): Promise<DocumentationSection[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/type/${type}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching documentation by type:', error);
      throw error;
    }
  }
}

export const documentationService = new DocumentationService(); 