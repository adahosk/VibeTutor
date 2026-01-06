export interface CourseModule {
  id: string;
  title: string;
  topics: string[];
  learningObjectives: string[];
}

export interface CourseStructure {
  title: string;
  description: string;
  modules: CourseModule[];
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
}

export interface KnowledgeNode {
  id: string;
  group: number;
  label: string;
  status: 'locked' | 'available' | 'completed';
}

export interface KnowledgeLink {
  source: string;
  target: string;
  value: number;
}

export interface KnowledgeGraphData {
  nodes: KnowledgeNode[];
  links: KnowledgeLink[];
}

export enum ContentDepth {
  SUMMARY = 'Summary',
  STANDARD = 'Standard',
  DEEP_DIVE = 'Deep Dive'
}

export interface ExamQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}
