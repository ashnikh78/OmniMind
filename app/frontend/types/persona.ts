export interface Persona {
  id: string;
  name: string;
  avatar: string;
  description: string;
  expertise: string[];
  specialties: string[];
  credentials: string[];
  communicationStyle: string;
  keyTopics: string[];
  tools?: string[];
} 