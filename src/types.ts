export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'admin' | 'user';
  createdAt: string;
}

export interface SocialAccount {
  id: string;
  platform: 'twitter' | 'instagram' | 'linkedin' | 'facebook';
  username: string;
  status: 'connected' | 'disconnected' | 'error';
  ownerId: string;
  connectedAt: string;
}

export interface AIAgent {
  id: string;
  name: string;
  specialty: 'Content Strategist' | 'Engagement Specialist' | 'Analytics Expert' | 'Brand Guardian' | 'Ranking Optimizer';
  status: 'active' | 'idle' | 'working';
  lastAction: string;
  ownerId: string;
}

export interface Post {
  id: string;
  content: string;
  platform: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  scheduledAt?: string;
  publishedAt?: string;
  authorId: string;
  agentId?: string;
  mediaUrls?: string[];
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  agentId?: string;
  ownerId: string;
}
