/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Share2, 
  Activity, 
  Settings, 
  Plus, 
  LogOut, 
  Twitter, 
  Instagram, 
  Linkedin, 
  Facebook, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  BrainCircuit,
  Send,
  BarChart3,
  MessageSquare,
  ShieldCheck,
  Zap,
  ChevronRight,
  MoreVertical,
  Search,
  Bell,
  Video,
  Image as ImageIcon,
  Mic,
  Volume2,
  Sparkles,
  MapPin,
  FileVideo,
  FileImage,
  FileAudio,
  FileText,
  Loader2,
  Paperclip,
  Maximize2,
  Trash2,
  Calendar,
  CheckSquare,
  Square
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  getDoc,
  addDoc, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  where,
  limit
} from 'firebase/firestore';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { GoogleGenAI, ThinkingLevel, Modality } from "@google/genai";

import { auth, db, storage, googleProvider, OperationType, handleFirestoreError, writeBatch } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { UserProfile, SocialAccount, AIAgent, Post, ActivityLog } from './types';
import { generatePost, optimizeForBusiness, OptimizationResult } from './services/geminiService';

// Extend window for AI Studio API key selection
declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error) errorMessage = parsed.error;
      } catch (e) {
        errorMessage = this.state.error.message || errorMessage;
      }

      return (
        <div className="h-screen w-full flex items-center justify-center bg-red-50 p-6">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-red-100">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mb-6">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">System Error</h2>
            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
              {errorMessage}
            </p>
            <Button 
              variant="primary" 
              className="w-full"
              onClick={() => window.location.reload()}
            >
              Restart Nexus
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger', size?: 'sm' | 'md' | 'lg' | 'icon' }>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variants = {
      primary: 'bg-[#141414] text-white hover:bg-black',
      secondary: 'bg-white text-[#141414] border border-[#141414] hover:bg-gray-50',
      outline: 'bg-transparent border border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-900',
      ghost: 'bg-transparent text-gray-600 hover:bg-gray-100',
      danger: 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-100',
    };
    const sizes = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
      icon: 'p-2',
    };
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-medium transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);

const Card = ({ children, className, title, subtitle, action }: { children: React.ReactNode, className?: string, title?: string, subtitle?: string, action?: React.ReactNode }) => (
  <div className={cn('bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm', className)}>
    {(title || action) && (
      <div className="px-6 py-4 border-bottom border-gray-50 flex items-center justify-between">
        <div>
          {title && <h3 className="text-sm font-semibold text-gray-900">{title}</h3>}
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
    )}
    <div className="p-6">{children}</div>
  </div>
);

const Badge = ({ children, variant = 'info' }: { children: React.ReactNode, variant?: 'info' | 'success' | 'warning' | 'error' | 'neutral' }) => {
  const variants = {
    info: 'bg-blue-50 text-blue-600',
    success: 'bg-green-50 text-green-600',
    warning: 'bg-amber-50 text-amber-600',
    error: 'bg-red-50 text-red-600',
    neutral: 'bg-gray-50 text-gray-600',
  };
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider', variants[variant])}>
      {children}
    </span>
  );
};

// --- Main App ---

export default function App() {
  return (
    <ErrorBoundary>
      <NexusApp />
    </ErrorBoundary>
  );
}

function NexusApp() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'agents' | 'accounts' | 'posts' | 'activity' | 'chat' | 'lab'>('dashboard');
  
  // Data State
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);

  // Chat State
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model', text: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);

  // Lab State
  const [labMode, setLabMode] = useState<'video' | 'image' | 'analysis' | 'optimize'>('image');
  const [labPrompt, setLabPrompt] = useState('');
  const [labResult, setLabResult] = useState<string | null>(null);
  const [labLoading, setLabLoading] = useState(false);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('twitter');
  const [analysisFile, setAnalysisFile] = useState<File | null>(null);
  const [analysisResult, setAnalysisResult] = useState('');

  // API Key State
  const [hasKey, setHasKey] = useState(false);

  // New Post State
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostPlatform, setNewPostPlatform] = useState<SocialAccount['platform']>('twitter');
  const [newPostScheduleDate, setNewPostScheduleDate] = useState(format(new Date(Date.now() + 86400000), "yyyy-MM-dd'T'HH:mm"));
  const [newPostFiles, setNewPostFiles] = useState<File[]>([]);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [existingMediaUrls, setExistingMediaUrls] = useState<string[]>([]);
  const [selectedPostIds, setSelectedPostIds] = useState<string[]>([]);
  const [isBulkRescheduleModalOpen, setIsBulkRescheduleModalOpen] = useState(false);
  const [bulkRescheduleDate, setBulkRescheduleDate] = useState(format(new Date(Date.now() + 86400000), "yyyy-MM-dd'T'HH:mm"));
  const [aiTopic, setAiTopic] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [newPostAgentId, setNewPostAgentId] = useState<string | undefined>(undefined);
  const [suggestedHashtags, setSuggestedHashtags] = useState<string[]>([]);
  const [isGeneratingHashtags, setIsGeneratingHashtags] = useState(false);
  const [isCreatingPost, setIsCreatingPost] = useState(false);

  // Auth Listener
  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected);
      }
    };
    checkKey();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Ensure profile exists in Firestore
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
          const newProfile: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || 'User',
            photoURL: firebaseUser.photoURL || '',
            role: 'user',
            createdAt: new Date().toISOString()
          };
          await setDoc(userRef, newProfile);
          setProfile(newProfile);
          
          // Seed initial agents
          const initialAgents: AIAgent[] = [
            { id: 'agent-1', name: 'Nova', specialty: 'Content Strategist', status: 'idle', lastAction: 'Initialized', ownerId: firebaseUser.uid },
            { id: 'agent-2', name: 'Echo', specialty: 'Engagement Specialist', status: 'idle', lastAction: 'Standing by', ownerId: firebaseUser.uid },
            { id: 'agent-3', name: 'Atlas', specialty: 'Analytics Expert', status: 'idle', lastAction: 'Monitoring trends', ownerId: firebaseUser.uid },
            { id: 'agent-4', name: 'Sentinel', specialty: 'Brand Guardian', status: 'idle', lastAction: 'Scanning for mentions', ownerId: firebaseUser.uid },
            { id: 'agent-5', name: 'Apex', specialty: 'Ranking Optimizer', status: 'idle', lastAction: 'Analyzing SEO algorithms', ownerId: firebaseUser.uid }
          ];
          
          for (const agent of initialAgents) {
            await setDoc(doc(db, 'users', firebaseUser.uid, 'aiAgents', agent.id), agent);
          }
        } else {
          setProfile(userSnap.data() as UserProfile);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    // OAuth Message Listener
    const handleOAuthMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }

      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const platform = event.data.platform;
        logActivity(`Successfully connected ${platform} account!`, 'success');
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => {
      unsubscribe();
      window.removeEventListener('message', handleOAuthMessage);
    };
  }, []);

  // Data Listeners
  useEffect(() => {
    if (!user) return;

    const unsubAccounts = onSnapshot(collection(db, 'users', user.uid, 'socialAccounts'), (snap) => {
      setAccounts(snap.docs.map(d => d.data() as SocialAccount));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'socialAccounts'));

    const unsubAgents = onSnapshot(collection(db, 'users', user.uid, 'aiAgents'), (snap) => {
      setAgents(snap.docs.map(d => d.data() as AIAgent));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'aiAgents'));

    const unsubPosts = onSnapshot(query(collection(db, 'users', user.uid, 'posts'), orderBy('scheduledAt', 'desc')), (snap) => {
      setPosts(snap.docs.map(d => d.data() as Post));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'posts'));

    const unsubActivity = onSnapshot(query(collection(db, 'users', user.uid, 'activity'), orderBy('timestamp', 'desc'), limit(50)), (snap) => {
      setActivity(snap.docs.map(d => d.data() as ActivityLog));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'activity'));

    return () => {
      unsubAccounts();
      unsubAgents();
      unsubPosts();
      unsubActivity();
    };
  }, [user]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const logActivity = async (message: string, type: ActivityLog['type'] = 'info', agentId?: string) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'users', user.uid, 'activity'), {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        message,
        type,
        agentId,
        ownerId: user.uid
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'activity');
    }
  };

  const handleBusinessOptimize = async () => {
    if (!labPrompt.trim()) return;
    setLabLoading(true);
    setOptimizationResult(null);
    try {
      const result = await optimizeForBusiness(labPrompt, selectedPlatform);
      setOptimizationResult(result);
      logActivity(`Optimized content for ${selectedPlatform} business account`, 'success');
    } catch (err) {
      console.error(err);
      logActivity('Failed to optimize content', 'error');
    } finally {
      setLabLoading(false);
    }
  };

  const handleGenerateText = async () => {
    if (!labPrompt.trim()) return;
    setLabLoading(true);
    try {
      const text = await generatePost(labPrompt, selectedPlatform);
      setLabPrompt(text);
      logActivity(`Generated ${selectedPlatform} post draft`, 'info');
    } catch (err) {
      console.error(err);
      logActivity('Failed to generate post', 'error');
    } finally {
      setLabLoading(false);
    }
  };
  const connectAccount = async (platform: SocialAccount['platform']) => {
    if (!user) return;

    try {
      // 1. Fetch the OAuth URL from our server
      const response = await fetch(`/api/auth/url?platform=${platform}`);
      if (!response.ok) {
        throw new Error('Failed to get auth URL');
      }
      const { url } = await response.json();

      // 2. Open the OAuth PROVIDER's URL directly in popup
      const authWindow = window.open(
        url,
        'oauth_popup',
        'width=600,height=700'
      );

      if (!authWindow) {
        alert('Please allow popups for this site to connect your account.');
      }
      
      logActivity(`Initiated connection for ${platform}...`, 'info');
    } catch (err) {
      console.error('OAuth initiation error:', err);
      logActivity(`Failed to initiate ${platform} connection`, 'error');
    }
  };

  const assignTask = async (agent: AIAgent) => {
    if (!user) return;
    
    // Update agent status
    const agentRef = doc(db, 'users', user.uid, 'aiAgents', agent.id);
    await updateDoc(agentRef, { status: 'working', lastAction: `Analyzing ${agent.specialty === 'Content Strategist' ? 'current trends' : 'local engagement'}...` });
    
    logActivity(`${agent.name} is now working on a new task.`, 'info', agent.id);

    // Simulate AI work with Grounding
    setTimeout(async () => {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      let tools: any[] = [];
      if (agent.specialty === 'Content Strategist') {
        tools = [{ googleSearch: {} }];
      } else if (agent.specialty === 'Engagement Specialist') {
        tools = [{ googleMaps: {} }];
      }

      const modelParams: any = {
        model: "gemini-3-flash-preview",
        contents: `You are ${agent.name}, a ${agent.specialty}. 
        ${agent.specialty === 'Content Strategist' ? 'Use Google Search to find the most trending topic in tech today.' : 'Use Google Maps to find a popular local event or spot.'}
        Based on that, generate a short, professional social media post idea. Return ONLY the post content.`
      };

      if (tools.length > 0) {
        modelParams.config = { tools };
      }
      
      try {
        const response = await ai.models.generateContent(modelParams);
        const content = response.text || "New post idea generated.";
        
        const postId = crypto.randomUUID();
        const newPost: Post = {
          id: postId,
          content,
          platform: accounts[0]?.platform || 'twitter',
          status: 'draft',
          scheduledAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour later
          authorId: user.uid,
          agentId: agent.id
        };
        
        await setDoc(doc(db, 'users', user.uid, 'posts', postId), newPost);
        await updateDoc(agentRef, { status: 'idle', lastAction: 'Finished generating post' });
        logActivity(`${agent.name} completed the task: Generated a new draft.`, 'success', agent.id);
      } catch (err) {
        console.error('AI error:', err);
        await updateDoc(agentRef, { status: 'idle', lastAction: 'Task failed' });
        logActivity(`${agent.name} failed to complete the task.`, 'error', agent.id);
      }
    }, 2000);
  };

  const handleChat = async () => {
    if (!chatInput.trim() || !user) return;
    
    const userMsg = chatInput;
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsChatting(true);

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: "You are the Nexus AI Core, a sophisticated team of AI agents managing social media. You are professional, insightful, and proactive. You can help with content strategy, engagement, and analytics.",
      },
      history: chatHistory.map(h => ({ role: h.role, parts: [{ text: h.text }] }))
    });

    try {
      const response = await chat.sendMessage({ message: userMsg });
      const aiText = response.text || "I'm processing your request.";
      setChatHistory(prev => [...prev, { role: 'model', text: aiText }]);
      
      // TTS for the response
      const ttsResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: aiText }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
          }
        }
      });
      
      const audioData = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (audioData) {
        const audio = new Audio(`data:audio/mp3;base64,${audioData}`);
        audio.play();
      }

    } catch (err) {
      console.error('Chat error:', err);
    } finally {
      setIsChatting(false);
    }
  };

  const generateVideo = async () => {
    if (!labPrompt.trim() || !user) return;
    if (!hasKey) {
      await window.aistudio.openSelectKey();
      setHasKey(true);
      return;
    }

    setLabLoading(true);
    setLabResult(null);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

    try {
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: labPrompt,
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: aspectRatio === '16:9' ? '16:9' : '9:16'
        }
      });

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (downloadLink) {
        const response = await fetch(downloadLink, {
          headers: { 'x-goog-api-key': process.env.API_KEY! }
        });
        const blob = await response.blob();
        setLabResult(URL.createObjectURL(blob));
      }
    } catch (err) {
      console.error('Video error:', err);
    } finally {
      setLabLoading(false);
    }
  };

  const generateImage = async () => {
    if (!labPrompt.trim() || !user) return;
    setLabLoading(true);
    setLabResult(null);
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: { parts: [{ text: labPrompt }] },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio as any,
            imageSize: "1K"
          }
        }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          setLabResult(`data:image/png;base64,${part.inlineData.data}`);
          break;
        }
      }
    } catch (err) {
      console.error('Image error:', err);
    } finally {
      setLabLoading(false);
    }
  };

  const analyzeFile = async () => {
    if (!analysisFile || !user) return;
    setLabLoading(true);
    setAnalysisResult('');
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

    try {
      const reader = new FileReader();
      reader.readAsDataURL(analysisFile);
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const mimeType = analysisFile.type;

        let modelId = "gemini-3.1-pro-preview";
        let prompt = "Analyze this content for social media potential. What are the key highlights?";
        
        if (mimeType.startsWith('audio/')) {
          modelId = "gemini-3-flash-preview";
          prompt = "Transcribe this audio and summarize the main points.";
        }

        const response = await ai.models.generateContent({
          model: modelId,
          contents: {
            parts: [
              { inlineData: { data: base64, mimeType } },
              { text: prompt }
            ]
          },
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
          }
        });

        setAnalysisResult(response.text || "Analysis complete.");
        setLabLoading(false);
      };
    } catch (err) {
      console.error('Analysis error:', err);
      setLabLoading(false);
    }
  };

  const handleCreatePost = async (statusOverride?: Post['status']) => {
    if (!newPostContent.trim() || !user) return;
    setIsCreatingPost(true);

    const postId = editingPost ? editingPost.id : crypto.randomUUID();
    const scheduledAt = new Date(newPostScheduleDate).toISOString();
    const isFuture = new Date(newPostScheduleDate) > new Date();

    // Upload new files if any
    const newMediaUrls: string[] = [];
    for (const file of newPostFiles) {
      const fileRef = ref(storage, `users/${user.uid}/posts/${postId}/${file.name}`);
      const snapshot = await uploadBytes(fileRef, file);
      const url = await getDownloadURL(snapshot.ref);
      newMediaUrls.push(url);
    }

    const finalMediaUrls = [...existingMediaUrls, ...newMediaUrls];

    const postData: Post = {
      id: postId,
      content: newPostContent,
      platform: newPostPlatform,
      status: statusOverride || (isFuture ? 'scheduled' : 'published'),
      scheduledAt: scheduledAt,
      publishedAt: statusOverride === 'draft' ? undefined : (isFuture ? (editingPost?.publishedAt || undefined) : (editingPost?.publishedAt || new Date().toISOString())),
      authorId: user.uid,
      mediaUrls: finalMediaUrls.length > 0 ? finalMediaUrls : undefined,
      agentId: newPostAgentId,
    };

    try {
      await setDoc(doc(db, 'users', user.uid, 'posts', postId), postData);
      logActivity(
        editingPost 
          ? `Updated ${postData.status} post for ${newPostPlatform}` 
          : `Manually ${postData.status === 'draft' ? 'saved a draft' : 'scheduled a post'} for ${newPostPlatform} with ${finalMediaUrls.length} attachments`, 
        'success'
      );
      setIsPostModalOpen(false);
      setEditingPost(null);
      setNewPostContent('');
      setNewPostFiles([]);
      setExistingMediaUrls([]);
    } catch (err) {
      handleFirestoreError(err, editingPost ? OperationType.UPDATE : OperationType.CREATE, 'posts');
    } finally {
      setIsCreatingPost(false);
    }
  };

  const openEditModal = (post: Post) => {
    setEditingPost(post);
    setNewPostContent(post.content);
    setNewPostPlatform(post.platform as any);
    setNewPostScheduleDate(format(new Date(post.scheduledAt || Date.now()), "yyyy-MM-dd'T'HH:mm"));
    setExistingMediaUrls(post.mediaUrls || []);
    setNewPostFiles([]);
    setNewPostAgentId(post.agentId);
    setSuggestedHashtags([]);
    setIsPostModalOpen(true);
  };

  const openCreateModal = () => {
    setEditingPost(null);
    setNewPostContent('');
    setNewPostPlatform('twitter');
    setNewPostScheduleDate(format(new Date(Date.now() + 86400000), "yyyy-MM-dd'T'HH:mm"));
    setExistingMediaUrls([]);
    setNewPostFiles([]);
    setNewPostAgentId(undefined);
    setAiTopic('');
    setSuggestedHashtags([]);
    setIsPostModalOpen(true);
  };

  const handleGenerateHashtags = async () => {
    if (!newPostContent.trim()) return;
    setIsGeneratingHashtags(true);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze the following social media post content and suggest 5 relevant hashtags. Output ONLY the hashtags separated by spaces, starting with #. Content: "${newPostContent}"`,
      });
      
      const text = response.text;
      if (text) {
        const hashtags = text.trim().split(/\s+/).filter(h => h.startsWith('#'));
        setSuggestedHashtags(hashtags);
        logActivity(`Generated ${hashtags.length} hashtag suggestions for post content`, 'info');
      }
    } catch (err) {
      console.error("Hashtag Generation Error:", err);
    } finally {
      setIsGeneratingHashtags(false);
    }
  };

  const addHashtag = (hashtag: string) => {
    if (!newPostContent.includes(hashtag)) {
      setNewPostContent(prev => prev.trim() + ' ' + hashtag);
    }
  };

  const handleGenerateAISuggestion = async () => {
    if (!aiTopic.trim()) return;
    setIsGeneratingAI(true);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `You are Nova, a Content Strategist AI agent for Nexus AI. Generate a short, engaging social media post for ${newPostPlatform} about the following topic: "${aiTopic}". Keep it professional yet creative. Just output the post content without any preamble or quotes.`,
      });
      
      const text = response.text;
      if (text) {
        setNewPostContent(text.trim());
        setNewPostAgentId('agent-1'); // Nova's ID
        logActivity(`Nova generated a content suggestion for topic: ${aiTopic}`, 'info', 'agent-1');
      }
    } catch (err) {
      console.error("AI Generation Error:", err);
      logActivity("Failed to generate AI suggestion", 'error');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const togglePostSelection = (postId: string) => {
    setSelectedPostIds(prev => 
      prev.includes(postId) 
        ? prev.filter(id => id !== postId) 
        : [...prev, postId]
    );
  };

  const handleBulkDelete = async () => {
    if (!user || selectedPostIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedPostIds.length} posts?`)) return;

    try {
      const batch = writeBatch(db);
      selectedPostIds.forEach(id => {
        batch.delete(doc(db, 'users', user.uid, 'posts', id));
      });
      await batch.commit();
      logActivity(`Bulk deleted ${selectedPostIds.length} posts`, 'success');
      setSelectedPostIds([]);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'posts');
    }
  };

  const handleBulkReschedule = async () => {
    if (!user || selectedPostIds.length === 0) return;
    const newDate = new Date(bulkRescheduleDate).toISOString();

    try {
      const batch = writeBatch(db);
      selectedPostIds.forEach(id => {
        batch.update(doc(db, 'users', user.uid, 'posts', id), {
          scheduledAt: newDate,
          status: 'scheduled'
        });
      });
      await batch.commit();
      logActivity(`Bulk rescheduled ${selectedPostIds.length} posts to ${bulkRescheduleDate}`, 'success');
      setSelectedPostIds([]);
      setIsBulkRescheduleModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'posts');
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#F9FAFB]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#141414] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-gray-500 font-mono">INITIALIZING NEXUS...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#050505] overflow-hidden relative">
        {/* Background Gradients */}
        <div className="absolute top-0 left-0 w-full h-full opacity-20">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600 rounded-full blur-[120px]" />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 text-center max-w-md px-6"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 backdrop-blur-xl rounded-2xl mb-8 border border-white/20">
            <BrainCircuit className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-5xl font-bold text-white tracking-tight mb-4 font-sans">NEXUS AI</h1>
          <p className="text-gray-400 text-lg mb-10 leading-relaxed">
            The next generation of social media management. Powered by a team of specialized AI agents.
          </p>
          <Button 
            onClick={handleLogin}
            className="w-full py-4 text-lg bg-white text-black hover:bg-gray-100 rounded-2xl flex items-center justify-center gap-3"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
            Connect with Google
          </Button>
          <p className="mt-6 text-xs text-gray-500 font-mono uppercase tracking-widest">Secure Command Protocol v1.0.4</p>
        </motion.div>
      </div>
    );
  }

  const chartData = [
    { name: 'Mon', engagement: 400, reach: 2400 },
    { name: 'Tue', engagement: 300, reach: 1398 },
    { name: 'Wed', engagement: 200, reach: 9800 },
    { name: 'Thu', engagement: 278, reach: 3908 },
    { name: 'Fri', engagement: 189, reach: 4800 },
    { name: 'Sat', engagement: 239, reach: 3800 },
    { name: 'Sun', engagement: 349, reach: 4300 },
  ];

  return (
    <div className="flex h-screen bg-[#F9FAFB] text-[#141414] font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-100 flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-[#141414] rounded-lg flex items-center justify-center">
            <BrainCircuit className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">NEXUS AI</span>
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-4">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { id: 'agents', icon: Users, label: 'AI Agents' },
            { id: 'chat', icon: MessageSquare, label: 'Agent Chat' },
            { id: 'lab', icon: Sparkles, label: 'AI Lab' },
            { id: 'accounts', icon: Share2, label: 'Accounts' },
            { id: 'posts', icon: Send, label: 'Posts' },
            { id: 'activity', icon: Activity, label: 'Activity' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all group',
                activeTab === item.id 
                  ? 'bg-[#141414] text-white shadow-lg shadow-black/5' 
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <item.icon className={cn('w-4 h-4', activeTab === item.id ? 'text-white' : 'text-gray-400 group-hover:text-gray-600')} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-50">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 mb-4">
            <img src={profile?.photoURL} className="w-8 h-8 rounded-full border border-white" alt="Avatar" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate">{profile?.displayName}</p>
              <p className="text-[10px] text-gray-500 truncate">{profile?.email}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="h-16 bg-white border-b border-gray-100 px-8 flex items-center justify-between sticky top-0 z-20">
          <h2 className="text-lg font-bold capitalize">{activeTab}</h2>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search command..." 
                className="pl-10 pr-4 py-2 bg-gray-50 border-none rounded-lg text-sm w-64 focus:ring-2 focus:ring-[#141414]/10 transition-all"
              />
            </div>
            <button className="p-2 text-gray-400 hover:text-gray-600 relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
            </button>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    { label: 'Total Reach', value: '124.5K', change: '+12%', icon: BarChart3, color: 'blue' },
                    { label: 'Engagement', value: '8.2%', change: '+2.4%', icon: Zap, color: 'amber' },
                    { label: 'Active Agents', value: agents.filter(a => a.status === 'working').length, change: 'Running', icon: BrainCircuit, color: 'purple' },
                    { label: 'Scheduled', value: posts.filter(p => p.status === 'scheduled').length, change: 'Next 24h', icon: Clock, color: 'green' },
                  ].map((stat, i) => (
                    <Card key={i} className="p-0">
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className={cn('p-2 rounded-lg', {
                            'bg-blue-50 text-blue-600': stat.color === 'blue',
                            'bg-amber-50 text-amber-600': stat.color === 'amber',
                            'bg-purple-50 text-purple-600': stat.color === 'purple',
                            'bg-green-50 text-green-600': stat.color === 'green',
                          })}>
                            <stat.icon className="w-5 h-5" />
                          </div>
                          <span className={cn('text-xs font-bold', stat.change.startsWith('+') ? 'text-green-600' : 'text-gray-500')}>
                            {stat.change}
                          </span>
                        </div>
                        <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
                        <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
                      </div>
                    </Card>
                  ))}
                </div>

                {/* Charts & Activity */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <Card className="lg:col-span-2" title="Performance Overview" subtitle="Reach vs Engagement across all platforms">
                    <div className="h-[300px] w-full mt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <defs>
                            <linearGradient id="colorReach" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#141414" stopOpacity={0.1}/>
                              <stop offset="95%" stopColor="#141414" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #F3F4F6', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          />
                          <Area type="monotone" dataKey="reach" stroke="#141414" fillOpacity={1} fill="url(#colorReach)" strokeWidth={2} />
                          <Area type="monotone" dataKey="engagement" stroke="#3B82F6" fillOpacity={0} strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  <Card title="Recent Activity" subtitle="Real-time agent logs">
                    <div className="space-y-6 mt-4">
                      {activity.slice(0, 5).map((log) => (
                        <div key={log.id} className="flex gap-4">
                          <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', {
                            'bg-blue-500': log.type === 'info',
                            'bg-green-500': log.type === 'success',
                            'bg-amber-500': log.type === 'warning',
                            'bg-red-500': log.type === 'error',
                          })} />
                          <div>
                            <p className="text-xs text-gray-900 leading-relaxed">{log.message}</p>
                            <p className="text-[10px] text-gray-400 mt-1 font-mono">{format(new Date(log.timestamp), 'HH:mm:ss')}</p>
                          </div>
                        </div>
                      ))}
                      {activity.length === 0 && (
                        <div className="text-center py-10">
                          <Activity className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                          <p className="text-xs text-gray-400">No activity yet</p>
                        </div>
                      )}
                    </div>
                  </Card>
                </div>
              </motion.div>
            )}

            {activeTab === 'agents' && (
              <motion.div 
                key="agents"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
              >
                {agents.map((agent) => (
                  <Card key={agent.id} className="group hover:border-gray-300 transition-all">
                    <div className="flex flex-col items-center text-center">
                      <div className="relative mb-4">
                        <div className="absolute -top-2 -right-2 z-10">
                          <Badge variant="success">AI Live</Badge>
                        </div>
                        <div className={cn(
                          'w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-500',
                          agent.status === 'working' ? 'bg-[#141414] scale-110 shadow-xl' : 'bg-gray-50'
                        )}>
                          <BrainCircuit className={cn('w-10 h-10', agent.status === 'working' ? 'text-white animate-pulse' : 'text-gray-400')} />
                        </div>
                        {agent.status === 'working' && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white" />
                        )}
                      </div>
                      <h3 className="font-bold text-gray-900">{agent.name}</h3>
                      <p className="text-xs text-blue-600 font-semibold mt-1 uppercase tracking-wider">{agent.specialty}</p>
                      
                      <div className="w-full h-px bg-gray-50 my-4" />
                      
                      <div className="w-full text-left bg-gray-50 rounded-lg p-3 mb-6">
                        <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-1">Current Status</p>
                        <p className="text-xs text-gray-600 italic">"{agent.lastAction}"</p>
                      </div>

                      <Button 
                        onClick={() => assignTask(agent)}
                        disabled={agent.status === 'working'}
                        className="w-full"
                        variant={agent.status === 'working' ? 'outline' : 'primary'}
                      >
                        {agent.status === 'working' ? 'Processing...' : 'Assign Task'}
                      </Button>
                    </div>
                  </Card>
                ))}
              </motion.div>
            )}

            {activeTab === 'chat' && (
              <motion.div 
                key="chat"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-4xl mx-auto h-[calc(100vh-12rem)] flex flex-col"
              >
                <Card className="flex-1 flex flex-col p-0 overflow-hidden">
                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {chatHistory.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                        <MessageSquare className="w-12 h-12 mb-4" />
                        <h3 className="text-lg font-bold">Start a conversation</h3>
                        <p className="text-sm">Ask Nexus AI for strategy advice or content ideas.</p>
                      </div>
                    )}
                    {chatHistory.map((msg, i) => (
                      <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                        <div className={cn(
                          'max-w-[80%] px-4 py-3 rounded-2xl text-sm',
                          msg.role === 'user' ? 'bg-[#141414] text-white' : 'bg-gray-100 text-gray-900'
                        )}>
                          {msg.text}
                        </div>
                      </div>
                    ))}
                    {isChatting && (
                      <div className="flex justify-start">
                        <div className="bg-gray-100 px-4 py-3 rounded-2xl flex gap-1">
                          <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                          <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                          <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-2">
                    <input 
                      type="text" 
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleChat()}
                      placeholder="Type your command..."
                      className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-[#141414]/10 outline-none"
                    />
                    <Button onClick={handleChat} disabled={isChatting || !chatInput.trim()}>
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              </motion.div>
            )}

            {activeTab === 'lab' && (
              <motion.div 
                key="lab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                <div className="flex gap-4 border-b border-gray-100 pb-4">
                  {[
                    { id: 'image', icon: ImageIcon, label: 'Image Gen' },
                    { id: 'video', icon: Video, label: 'Video Gen' },
                    { id: 'analysis', icon: Maximize2, label: 'Multi-modal Analysis' },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => { setLabMode(mode.id as any); setLabResult(null); }}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                        labMode === mode.id ? 'bg-[#141414] text-white' : 'text-gray-500 hover:bg-gray-100'
                      )}
                    >
                      <mode.icon className="w-4 h-4" />
                      {mode.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    {labMode === 'optimize' ? (
                      <Card title="Business Strategy Lab">
                        <div className="space-y-4">
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 block">Target Platform</label>
                            <div className="grid grid-cols-4 gap-2">
                              {['twitter', 'instagram', 'linkedin', 'facebook'].map((p) => (
                                <button
                                  key={p}
                                  onClick={() => setSelectedPlatform(p)}
                                  className={cn(
                                    'py-2 rounded-lg text-[10px] font-bold uppercase border transition-all',
                                    selectedPlatform === p ? 'bg-[#141414] text-white border-[#141414]' : 'bg-white text-gray-400 border-gray-200'
                                  )}
                                >
                                  {p}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 block">Content Draft or Topic</label>
                            <textarea 
                              value={labPrompt}
                              onChange={(e) => setLabPrompt(e.target.value)}
                              placeholder="Enter your post draft or a topic to generate from scratch..."
                              className="w-full h-48 bg-gray-50 border-none rounded-xl p-4 text-sm focus:ring-2 focus:ring-[#141414]/10 outline-none resize-none"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline"
                              onClick={handleGenerateText}
                              disabled={labLoading || !labPrompt.trim()}
                              className="flex-1 py-4 gap-2"
                            >
                              <Sparkles className="w-4 h-4" />
                              AI Draft
                            </Button>
                            <Button 
                              onClick={handleBusinessOptimize}
                              disabled={labLoading || !labPrompt.trim()}
                              className="flex-1 py-4 gap-2"
                            >
                              {labLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                              Optimize & Rank
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ) : labMode !== 'analysis' ? (
                      <Card title="Generation Parameters">
                        <div className="space-y-4">
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 block">Prompt</label>
                            <textarea 
                              value={labPrompt}
                              onChange={(e) => setLabPrompt(e.target.value)}
                              placeholder={labMode === 'video' ? "A cinematic drone shot of a futuristic city..." : "A professional 3D render of a social media icon..."}
                              className="w-full h-32 bg-gray-50 border-none rounded-xl p-4 text-sm focus:ring-2 focus:ring-[#141414]/10 outline-none resize-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 block">Aspect Ratio</label>
                            <div className="grid grid-cols-4 gap-2">
                              {['1:1', '4:3', '16:9', '9:16', '21:9', '3:4', '2:3', '3:2'].map((ratio) => (
                                <button
                                  key={ratio}
                                  onClick={() => setAspectRatio(ratio)}
                                  className={cn(
                                    'py-2 rounded-lg text-xs font-medium border transition-all',
                                    aspectRatio === ratio ? 'bg-[#141414] text-white border-[#141414]' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                                  )}
                                >
                                  {ratio}
                                </button>
                              ))}
                            </div>
                          </div>
                          <Button 
                            onClick={labMode === 'video' ? generateVideo : generateImage}
                            disabled={labLoading || !labPrompt.trim()}
                            className="w-full py-4 gap-2"
                          >
                            {labLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            {labMode === 'video' ? 'Generate Video' : 'Generate Image'}
                          </Button>
                        </div>
                      </Card>
                    ) : (
                      <Card title="Upload & Analyze">
                        <div className="space-y-4">
                          <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center hover:border-gray-400 transition-all cursor-pointer relative">
                            <input 
                              type="file" 
                              className="absolute inset-0 opacity-0 cursor-pointer"
                              onChange={(e) => setAnalysisFile(e.target.files?.[0] || null)}
                              accept="image/*,video/*,audio/*"
                            />
                            {analysisFile ? (
                              <div className="flex flex-col items-center">
                                {analysisFile.type.startsWith('image/') && <FileImage className="w-12 h-12 text-blue-500 mb-2" />}
                                {analysisFile.type.startsWith('video/') && <FileVideo className="w-12 h-12 text-purple-500 mb-2" />}
                                {analysisFile.type.startsWith('audio/') && <FileAudio className="w-12 h-12 text-green-500 mb-2" />}
                                <p className="text-sm font-bold">{analysisFile.name}</p>
                                <p className="text-xs text-gray-400 mt-1">{(analysisFile.size / 1024 / 1024).toFixed(2)} MB</p>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center">
                                <Paperclip className="w-12 h-12 text-gray-200 mb-2" />
                                <p className="text-sm font-bold">Drop media here</p>
                                <p className="text-xs text-gray-400 mt-1">Supports Image, Video, and Audio</p>
                              </div>
                            )}
                          </div>
                          <Button 
                            onClick={analyzeFile}
                            disabled={labLoading || !analysisFile}
                            className="w-full py-4 gap-2"
                          >
                            {labLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
                            Run Deep Analysis
                          </Button>
                        </div>
                      </Card>
                    )}
                  </div>

                  <div className="space-y-6">
                    <Card title="Result Preview" className="h-full min-h-[400px] flex flex-col">
                      <div className="flex-1 flex items-center justify-center bg-gray-50 rounded-xl overflow-hidden relative">
                        {labLoading ? (
                          <div className="text-center">
                            <Loader2 className="w-12 h-12 text-gray-200 animate-spin mx-auto mb-4" />
                            <p className="text-sm text-gray-400 font-mono">NEXUS IS THINKING...</p>
                          </div>
                        ) : optimizationResult ? (
                          <div className="p-6 w-full h-full overflow-y-auto space-y-6">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-amber-600">
                                <Zap className="w-4 h-4" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Optimization Strategy</span>
                              </div>
                              <div className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-600 rounded-full border border-green-100">
                                <span className="text-[10px] font-bold uppercase tracking-wider">SEO Score: {optimizationResult.seoScore}</span>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Optimized Post</label>
                              <div className="p-4 bg-white border border-gray-100 rounded-xl text-sm leading-relaxed text-gray-900 shadow-sm">
                                {optimizationResult.optimizedContent}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Ranking Reasoning</label>
                              <p className="text-xs text-gray-600 italic">"{optimizationResult.reasoning}"</p>
                            </div>

                            <div className="space-y-2">
                              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Engagement Tips</label>
                              <ul className="space-y-2">
                                {optimizationResult.engagementTips.map((tip, i) => (
                                  <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                                    <div className="w-1.5 h-1.5 bg-amber-400 rounded-full mt-1 shrink-0" />
                                    {tip}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        ) : labResult ? (
                          labMode === 'video' ? (
                            <video src={labResult} controls className="w-full h-full object-contain" />
                          ) : (
                            <img src={labResult} className="w-full h-full object-contain" alt="Result" />
                          )
                        ) : analysisResult ? (
                          <div className="p-6 w-full h-full overflow-y-auto text-sm leading-relaxed text-gray-700">
                            <div className="flex items-center gap-2 mb-4 text-blue-600">
                              <ShieldCheck className="w-4 h-4" />
                              <span className="text-[10px] font-bold uppercase tracking-widest">Analysis Report</span>
                            </div>
                            {analysisResult}
                          </div>
                        ) : (
                          <div className="text-center opacity-20">
                            <Sparkles className="w-16 h-16 mx-auto mb-4" />
                            <p className="text-sm font-bold">Awaiting Input</p>
                          </div>
                        )}
                      </div>
                      {(labResult || analysisResult) && (
                        <div className="mt-4 flex gap-2">
                          <Button variant="outline" size="sm" className="flex-1" onClick={() => { setLabResult(null); setAnalysisResult(''); }}>Clear</Button>
                          <Button variant="primary" size="sm" className="flex-1">Save to Assets</Button>
                        </div>
                      )}
                    </Card>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'accounts' && (
              <motion.div 
                key="accounts"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-2xl mx-auto space-y-6"
              >
                <Card 
                  title="Connected Platforms" 
                  subtitle="Manage your real-world social media integrations"
                  className="relative overflow-hidden"
                >
                  <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1 bg-green-50 text-green-600 rounded-full border border-green-100">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Live Integration</span>
                  </div>
                  <div className="space-y-4 mt-4">
                    {[
                      { id: 'twitter', name: 'X / Twitter', icon: Twitter, color: 'black' },
                      { id: 'instagram', name: 'Instagram', icon: Instagram, color: 'pink-600' },
                      { id: 'linkedin', name: 'LinkedIn', icon: Linkedin, color: 'blue-700' },
                      { id: 'facebook', name: 'Facebook', icon: Facebook, color: 'blue-600' },
                    ].map((platform) => {
                      const connected = accounts.find(a => a.platform === platform.id);
                      return (
                        <div key={platform.id} className="flex items-center justify-between p-4 rounded-xl border border-gray-50 bg-gray-50/50">
                          <div className="flex items-center gap-4">
                            <div className={cn('p-3 rounded-xl bg-white shadow-sm', `text-${platform.color}`)}>
                              <platform.icon className="w-6 h-6" />
                            </div>
                            <div>
                              <p className="font-bold text-sm">{platform.name}</p>
                              {connected ? (
                                <p className="text-xs text-green-600 flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> {connected.username}
                                </p>
                              ) : (
                                <p className="text-xs text-gray-400">Not connected</p>
                              )}
                            </div>
                          </div>
                          {connected ? (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={async () => {
                                await deleteDoc(doc(db, 'users', user.uid, 'socialAccounts', connected.id));
                                logActivity(`Disconnected ${platform.name}`, 'warning');
                              }}
                            >
                              Disconnect
                            </Button>
                          ) : (
                            <Button variant="primary" size="sm" onClick={() => connectAccount(platform.id as any)}>
                              Connect
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>

                <Card className="bg-[#141414] text-white border-none">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Enterprise Security</h3>
                      <p className="text-sm text-gray-400 mt-1">
                        Your account permissions are managed via secure OAuth protocols. Nexus AI never stores your passwords.
                      </p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}

            {activeTab === 'posts' && (
              <motion.div 
                key="posts"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <Button variant="primary" className="gap-2" onClick={openCreateModal}>
                      <Plus className="w-4 h-4" /> New Post
                    </Button>
                    <Button variant="outline">Drafts ({posts.filter(p => p.status === 'draft').length})</Button>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Clock className="w-4 h-4" />
                    {posts.filter(p => p.status === 'scheduled').length > 0 
                      ? `${posts.filter(p => p.status === 'scheduled').length} posts scheduled`
                      : 'No posts scheduled'}
                  </div>
                </div>

                {/* Bulk Actions Bar */}
                <AnimatePresence>
                  {selectedPostIds.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 bg-[#141414] text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6"
                    >
                      <div className="flex items-center gap-2 border-r border-white/10 pr-6">
                        <span className="text-sm font-bold">{selectedPostIds.length} selected</span>
                        <button 
                          onClick={() => setSelectedPostIds([])}
                          className="text-xs text-gray-400 hover:text-white underline"
                        >
                          Clear
                        </button>
                      </div>
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={() => setIsBulkRescheduleModalOpen(true)}
                          className="flex items-center gap-2 text-sm hover:text-blue-400 transition-colors"
                        >
                          <Calendar className="w-4 h-4" /> Reschedule
                        </button>
                        <button 
                          onClick={handleBulkDelete}
                          className="flex items-center gap-2 text-sm hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" /> Delete
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Bulk Reschedule Modal */}
                <AnimatePresence>
                  {isBulkRescheduleModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
                      >
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                          <h3 className="font-bold text-gray-900">Bulk Reschedule</h3>
                          <button onClick={() => setIsBulkRescheduleModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                            <Plus className="w-5 h-5 rotate-45" />
                          </button>
                        </div>
                        <div className="p-6">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 block">New Date & Time</label>
                          <input 
                            type="datetime-local"
                            value={bulkRescheduleDate}
                            onChange={(e) => setBulkRescheduleDate(e.target.value)}
                            className="w-full bg-gray-50 border-none rounded-xl p-4 text-sm focus:ring-2 focus:ring-[#141414]/10 outline-none"
                          />
                        </div>
                        <div className="px-6 py-4 bg-gray-50 flex gap-3">
                          <Button variant="outline" className="flex-1" onClick={() => setIsBulkRescheduleModalOpen(false)}>Cancel</Button>
                          <Button 
                            variant="primary" 
                            className="flex-1" 
                            onClick={handleBulkReschedule}
                          >
                            Reschedule
                          </Button>
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>

                {/* New Post Modal */}
                <AnimatePresence>
                  {isPostModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
                      >
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                          <h3 className="font-bold text-gray-900">{editingPost ? 'Edit Post' : 'Create New Post'}</h3>
                          <button onClick={() => setIsPostModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                            <Plus className="w-5 h-5 rotate-45" />
                          </button>
                        </div>
                        <div className="p-6 space-y-6">
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 block">Platform</label>
                            <div className="flex gap-2">
                              {[
                                { id: 'twitter', icon: Twitter },
                                { id: 'instagram', icon: Instagram },
                                { id: 'linkedin', icon: Linkedin },
                                { id: 'facebook', icon: Facebook },
                              ].map((p) => (
                                <button
                                  key={p.id}
                                  onClick={() => setNewPostPlatform(p.id as any)}
                                  className={cn(
                                    'p-3 rounded-xl border transition-all',
                                    newPostPlatform === p.id ? 'bg-[#141414] text-white border-[#141414]' : 'bg-white text-gray-400 border-gray-100 hover:border-gray-300'
                                  )}
                                >
                                  <p.icon className="w-5 h-5" />
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 block">AI Suggestion (Nova)</label>
                            <div className="flex gap-2 mb-4">
                              <input 
                                type="text"
                                value={aiTopic}
                                onChange={(e) => setAiTopic(e.target.value)}
                                placeholder="Enter a topic or keyword..."
                                className="flex-1 bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#141414]/10 outline-none"
                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleGenerateAISuggestion())}
                              />
                              <button 
                                onClick={handleGenerateAISuggestion}
                                disabled={isGeneratingAI || !aiTopic.trim()}
                                className="bg-[#141414] text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-gray-800 transition-all disabled:opacity-50"
                              >
                                {isGeneratingAI ? <Loader2 className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
                                Suggest
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 block">Content</label>
                            <textarea 
                              value={newPostContent}
                              onChange={(e) => setNewPostContent(e.target.value)}
                              placeholder="What's on your mind?"
                              className="w-full h-32 bg-gray-50 border-none rounded-xl p-4 text-sm focus:ring-2 focus:ring-[#141414]/10 outline-none resize-none"
                            />
                            <div className="mt-2 flex flex-wrap gap-2">
                              {suggestedHashtags.length > 0 ? (
                                suggestedHashtags.map((tag, i) => (
                                  <button
                                    key={i}
                                    onClick={() => addHashtag(tag)}
                                    className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded-md hover:bg-blue-100 transition-colors"
                                  >
                                    {tag}
                                  </button>
                                ))
                              ) : (
                                <button
                                  onClick={handleGenerateHashtags}
                                  disabled={isGeneratingHashtags || !newPostContent.trim()}
                                  className="text-[10px] font-bold text-gray-400 hover:text-[#141414] transition-colors flex items-center gap-1"
                                >
                                  {isGeneratingHashtags ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                  Suggest Hashtags
                                </button>
                              )}
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 block">Schedule For</label>
                            <input 
                              type="datetime-local"
                              value={newPostScheduleDate}
                              onChange={(e) => setNewPostScheduleDate(e.target.value)}
                              className="w-full bg-gray-50 border-none rounded-xl p-4 text-sm focus:ring-2 focus:ring-[#141414]/10 outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 block">Media Attachments</label>
                            <div className="flex flex-wrap gap-2 mb-2">
                              {existingMediaUrls.map((url, i) => (
                                <div key={`existing-${i}`} className="relative w-20 h-20 bg-gray-100 rounded-xl overflow-hidden group">
                                  {url.includes('.mp4') || url.includes('.mov') || url.includes('.webm') ? (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <FileVideo className="w-8 h-8 text-gray-400" />
                                    </div>
                                  ) : (
                                    <img src={url} className="w-full h-full object-cover" alt="Existing" referrerPolicy="no-referrer" />
                                  )}
                                  <button 
                                    onClick={() => setExistingMediaUrls(prev => prev.filter((_, idx) => idx !== i))}
                                    className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <Plus className="w-3 h-3 rotate-45" />
                                  </button>
                                </div>
                              ))}
                              {newPostFiles.map((file, i) => (
                                <div key={i} className="relative w-20 h-20 bg-gray-100 rounded-xl overflow-hidden group">
                                  {file.type.startsWith('image/') ? (
                                    <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" alt="Preview" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <FileVideo className="w-8 h-8 text-gray-400" />
                                    </div>
                                  )}
                                  <button 
                                    onClick={() => setNewPostFiles(prev => prev.filter((_, idx) => idx !== i))}
                                    className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <Plus className="w-3 h-3 rotate-45" />
                                  </button>
                                </div>
                              ))}
                              <label className="w-20 h-20 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-gray-400 transition-all">
                                <input 
                                  type="file" 
                                  className="hidden" 
                                  multiple 
                                  accept="image/*,video/*"
                                  onChange={(e) => {
                                    if (e.target.files) {
                                      setNewPostFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                                    }
                                  }}
                                />
                                <Plus className="w-6 h-6 text-gray-300" />
                                <span className="text-[8px] font-bold text-gray-400 uppercase mt-1">Add</span>
                              </label>
                            </div>
                          </div>
                        </div>
                        <div className="px-6 py-4 bg-gray-50 flex gap-3">
                          <Button variant="outline" className="flex-1 gap-2" onClick={() => handleCreatePost('draft')}>
                            {isCreatingPost ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                            Save Draft
                          </Button>
                          <Button 
                            variant="primary" 
                            className="flex-1 gap-2" 
                            onClick={() => handleCreatePost()}
                            disabled={isCreatingPost || !newPostContent.trim()}
                          >
                            {isCreatingPost ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                            {editingPost ? 'Save Changes' : 'Schedule Post'}
                          </Button>
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {posts.map((post) => (
                    <Card 
                      key={post.id} 
                      className={cn(
                        "relative group transition-all",
                        selectedPostIds.includes(post.id) ? "ring-2 ring-[#141414] bg-gray-50" : ""
                      )}
                    >
                      <div className="absolute top-4 left-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => togglePostSelection(post.id)}
                          className="p-1 bg-white rounded shadow-sm border border-gray-100"
                        >
                          {selectedPostIds.includes(post.id) ? (
                            <CheckSquare className="w-4 h-4 text-[#141414]" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-300" />
                          )}
                        </button>
                      </div>
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                            {post.platform === 'twitter' && <Twitter className="w-4 h-4" />}
                            {post.platform === 'instagram' && <Instagram className="w-4 h-4" />}
                            {post.platform === 'linkedin' && <Linkedin className="w-4 h-4" />}
                            {post.platform === 'facebook' && <Facebook className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{post.platform}</p>
                            <Badge variant={post.status === 'published' ? 'success' : post.status === 'scheduled' ? 'info' : 'neutral'}>
                              {post.status}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {(post.status === 'scheduled' || post.status === 'draft') && (
                            <button 
                              onClick={() => openEditModal(post)}
                              className="p-2 text-gray-400 hover:text-[#141414] hover:bg-gray-100 rounded-lg transition-all"
                              title="Edit Post"
                            >
                              <Settings className="w-4 h-4" />
                            </button>
                          )}
                          <button className="text-gray-400 hover:text-gray-600">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-800 leading-relaxed mb-4">
                        {post.content}
                      </p>

                      {post.mediaUrls && post.mediaUrls.length > 0 && (
                        <div className={cn(
                          "grid gap-2 mb-6",
                          post.mediaUrls.length === 1 ? "grid-cols-1" : "grid-cols-2"
                        )}>
                          {post.mediaUrls.map((url, i) => (
                            <div key={i} className="relative aspect-video rounded-xl overflow-hidden bg-gray-100">
                              {url.includes('.mp4') || url.includes('.mov') || url.includes('.webm') ? (
                                <video src={url} className="w-full h-full object-cover" />
                              ) : (
                                <img src={url} className="w-full h-full object-cover" alt="Post media" referrerPolicy="no-referrer" />
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-[#141414] rounded flex items-center justify-center">
                            <BrainCircuit className="w-3 h-3 text-white" />
                          </div>
                          <span className="text-[10px] font-medium text-gray-500">
                            Generated by {agents.find(a => a.id === post.agentId)?.name || 'Nexus'}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-gray-400">
                          {post.scheduledAt ? format(new Date(post.scheduledAt), 'MMM d, HH:mm') : 'No date'}
                        </span>
                      </div>
                    </Card>
                  ))}
                  {posts.length === 0 && (
                    <div className="col-span-2 py-20 text-center border-2 border-dashed border-gray-100 rounded-3xl">
                      <Send className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                      <h3 className="font-bold text-gray-900">No posts scheduled</h3>
                      <p className="text-sm text-gray-500 mt-1">Assign a task to an agent to get started.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'activity' && (
              <motion.div 
                key="activity"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-3xl mx-auto"
              >
                <Card title="Command Logs" subtitle="Full audit trail of all AI agent operations">
                  <div className="space-y-8 mt-6">
                    {activity.map((log, i) => (
                      <div key={log.id} className="relative flex gap-6">
                        {i !== activity.length - 1 && (
                          <div className="absolute left-[15px] top-8 bottom-[-32px] w-px bg-gray-100" />
                        )}
                        <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10', {
                          'bg-blue-50 text-blue-600': log.type === 'info',
                          'bg-green-50 text-green-600': log.type === 'success',
                          'bg-amber-50 text-amber-600': log.type === 'warning',
                          'bg-red-50 text-red-600': log.type === 'error',
                        })}>
                          {log.type === 'info' && <Activity className="w-4 h-4" />}
                          {log.type === 'success' && <CheckCircle2 className="w-4 h-4" />}
                          {log.type === 'warning' && <AlertCircle className="w-4 h-4" />}
                          {log.type === 'error' && <AlertCircle className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <p className="text-sm font-bold text-gray-900">{log.message}</p>
                            <span className="text-[10px] font-mono text-gray-400">{format(new Date(log.timestamp), 'HH:mm:ss')}</span>
                          </div>
                          {log.agentId && (
                            <div className="flex items-center gap-1.5">
                              <BrainCircuit className="w-3 h-3 text-gray-400" />
                              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">
                                {agents.find(a => a.id === log.agentId)?.name}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
