import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  parseSyllabus, 
  generateLessonContent, 
  generateAudioLesson, 
  chatWithSidekick, 
  generateExam,
  fileToGenerativePart,
  generateKnowledgeGraph
} from './services/geminiService';
import { CourseStructure, CourseModule, ContentDepth, Message, ExamQuestion, KnowledgeGraphData } from './types';
import { decodeAudioData, playAudioBuffer } from './utils/audioUtils';
import ExamModal from './components/ExamModal';
import KnowledgeGraph from './components/KnowledgeGraph';

const App: React.FC = () => {
  // State
  const [syllabusFile, setSyllabusFile] = useState<string | null>(null);
  const [structure, setStructure] = useState<CourseStructure | null>(null);
  const [activeModule, setActiveModule] = useState<CourseModule | null>(null);
  const [lessonContent, setLessonContent] = useState<string>("");
  const [contentDepth, setContentDepth] = useState<ContentDepth>(ContentDepth.STANDARD);
  
  // Chat State
  const [chatOpen, setChatOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatImage, setChatImage] = useState<string | null>(null);
  
  // Loading States
  const [loadingStructure, setLoadingStructure] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  
  // Advanced Features State
  const [showGraph, setShowGraph] = useState(false);
  const [graphData, setGraphData] = useState<KnowledgeGraphData | null>(null);
  const [examQuestions, setExamQuestions] = useState<ExamQuestion[]>([]);
  const [showExam, setShowExam] = useState(false);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Initialize Audio Context on Interaction
  useEffect(() => {
    const initAudio = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
    };
    window.addEventListener('click', initAudio);
    return () => window.removeEventListener('click', initAudio);
  }, []);

  // Handle File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLoadingStructure(true);
      try {
        const base64 = await fileToGenerativePart(file);
        setSyllabusFile(base64);
        
        // Step 1: Parse Structure
        const struct = await parseSyllabus(base64);
        setStructure(struct);

        // Step 2: Generate Knowledge Graph in background
        generateKnowledgeGraph(base64).then(setGraphData);

      } catch (err) {
        console.error(err);
        alert("Failed to process syllabus. Please try again.");
      } finally {
        setLoadingStructure(false);
      }
    }
  };

  // Handle Module Selection
  const handleModuleSelect = async (module: CourseModule) => {
    setActiveModule(module);
    setLoadingContent(true);
    try {
        if (!syllabusFile) return;
        const content = await generateLessonContent(syllabusFile, module.title, module.topics, contentDepth);
        setLessonContent(content);
    } catch (err) {
        console.error(err);
    } finally {
        setLoadingContent(false);
    }
  };

  // Handle Depth Change
  useEffect(() => {
    if (activeModule && syllabusFile) {
        setLoadingContent(true);
        generateLessonContent(syllabusFile, activeModule.title, activeModule.topics, contentDepth)
            .then(setLessonContent)
            .finally(() => setLoadingContent(false));
    }
  }, [contentDepth]);

  // Handle Audio Tutor
  const playAudioTutor = async () => {
    if (!lessonContent) return;
    setLoadingAudio(true);
    try {
        // Summarize logic could be added here to avoid reading strict markdown syntax
        const textToRead = lessonContent.substring(0, 500); // Limit for demo speed
        const audioBase64 = await generateAudioLesson(textToRead);
        
        if (audioBase64 && audioContextRef.current) {
            const buffer = await decodeAudioData(audioBase64, audioContextRef.current);
            playAudioBuffer(buffer, audioContextRef.current);
        }
    } catch (err) {
        console.error(err);
    } finally {
        setLoadingAudio(false);
    }
  };

  // Handle Exam
  const startExam = async () => {
      if (!activeModule || !syllabusFile) return;
      const questions = await generateExam(syllabusFile, activeModule.title);
      setExamQuestions(questions);
      setShowExam(true);
  };

  // Handle Chat
  const handleSendMessage = async () => {
      if (!chatInput.trim() && !chatImage) return;

      const userMsg: Message = {
          id: Date.now().toString(),
          role: 'user',
          content: chatInput,
          timestamp: Date.now()
      };
      setChatHistory(prev => [...prev, userMsg]);
      setChatInput("");
      setChatImage(null);
      setIsChatting(true);

      try {
          // Construct history for Gemini
          const apiHistory = chatHistory.map(h => ({
              role: h.role,
              parts: [{ text: h.content }]
          }));

          const context = lessonContent || "General Syllabus Context";
          const responseText = await chatWithSidekick(apiHistory, userMsg.content, context, chatImage || undefined);

          const modelMsg: Message = {
              id: (Date.now() + 1).toString(),
              role: 'model',
              content: responseText,
              timestamp: Date.now()
          };
          setChatHistory(prev => [...prev, modelMsg]);
      } catch (err) {
          console.error(err);
      } finally {
          setIsChatting(false);
          chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
  };

  // Explain Selection
  const handleExplainSelection = async () => {
      const selection = window.getSelection()?.toString();
      if (!selection) return;

      setChatOpen(true);
      setChatInput(`Explain this specific part to me like I'm 5: "${selection}"`);
      // User still needs to press send, or we can auto-send. Let's auto-fill.
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const base64 = await fileToGenerativePart(e.target.files[0]);
          setChatImage(base64);
      }
  };

  // RENDER: Upload Screen
  if (!structure && !loadingStructure) {
      return (
          <div className="flex items-center justify-center min-h-screen bg-slate-50">
              <div className="text-center space-y-6 p-10 bg-white rounded-2xl shadow-xl max-w-lg w-full">
                  <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto text-white text-4xl">
                      <i className="fas fa-book-open"></i>
                  </div>
                  <h1 className="text-3xl font-bold text-slate-800">Syllabus Engine</h1>
                  <p className="text-slate-500">Upload your course syllabus PDF to generate an interactive AI tutor.</p>
                  
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-blue-200 bg-blue-50 rounded-xl p-10 cursor-pointer hover:bg-blue-100 transition-colors"
                  >
                      <i className="fas fa-cloud-upload-alt text-4xl text-blue-400 mb-2"></i>
                      <p className="font-medium text-blue-700">Click to upload PDF</p>
                      <input 
                        ref={fileInputRef} 
                        type="file" 
                        accept="application/pdf" 
                        className="hidden" 
                        onChange={handleFileUpload}
                      />
                  </div>
              </div>
          </div>
      );
  }

  // RENDER: Loading Structure
  if (loadingStructure) {
      return (
          <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
              <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600 mb-4"></div>
              <p className="text-xl font-medium text-slate-700">Analyzing Syllabus Structure...</p>
              <p className="text-sm text-slate-500">This requires deep thinking (Gemini 3 Pro)</p>
          </div>
      );
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans">
      
      {/* Sidebar */}
      <div className="w-72 bg-white border-r border-slate-200 flex flex-col hidden md:flex">
        <div className="p-5 border-b border-slate-100">
            <h1 className="font-bold text-xl text-slate-800 tracking-tight">{structure?.title}</h1>
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{structure?.description}</p>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
            <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Modules</div>
            {structure?.modules.map((mod, idx) => (
                <button
                    key={idx}
                    onClick={() => handleModuleSelect(mod)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center justify-between group ${
                        activeModule?.title === mod.title 
                        ? 'bg-blue-50 text-blue-700 font-medium' 
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                >
                    <span>{idx + 1}. {mod.title}</span>
                    {activeModule?.title === mod.title && <i className="fas fa-chevron-right text-xs"></i>}
                </button>
            ))}
        </div>
        <div className="p-4 border-t border-slate-100">
             <button 
                onClick={() => setShowGraph(true)}
                className="w-full flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 py-2 rounded-lg text-sm font-medium hover:bg-indigo-100 transition"
             >
                 <i className="fas fa-project-diagram"></i> View Knowledge Graph
             </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
          
          {/* Header */}
          <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
              <h2 className="font-bold text-slate-700 truncate">
                  {activeModule ? activeModule.title : "Welcome to your Course"}
              </h2>
              <div className="flex items-center gap-3">
                  {/* Depth Slider */}
                  <div className="flex items-center bg-slate-100 rounded-lg p-1 mr-4">
                      {Object.values(ContentDepth).map((d) => (
                          <button
                            key={d}
                            onClick={() => setContentDepth(d)}
                            className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                                contentDepth === d 
                                ? 'bg-white text-slate-800 shadow-sm' 
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                              {d}
                          </button>
                      ))}
                  </div>

                  <button 
                    onClick={playAudioTutor}
                    disabled={loadingAudio || !lessonContent}
                    className="p-2 text-slate-500 hover:text-blue-600 transition"
                    title="Podcast Mode"
                  >
                      {loadingAudio ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-headphones"></i>}
                  </button>
                  <button 
                    onClick={startExam}
                    disabled={!activeModule}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition shadow-sm"
                  >
                      Simulate Exam
                  </button>
              </div>
          </header>

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto p-8 relative" onMouseUp={handleExplainSelection}>
              {!activeModule ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400">
                      <i className="fas fa-layer-group text-5xl mb-4 text-slate-200"></i>
                      <p>Select a module from the sidebar to begin learning.</p>
                  </div>
              ) : loadingContent ? (
                  <div className="space-y-4 animate-pulse">
                      <div className="h-8 bg-slate-200 rounded w-1/3"></div>
                      <div className="h-4 bg-slate-200 rounded w-full"></div>
                      <div className="h-4 bg-slate-200 rounded w-full"></div>
                      <div className="h-4 bg-slate-200 rounded w-2/3"></div>
                      <div className="h-64 bg-slate-100 rounded w-full mt-8"></div>
                  </div>
              ) : (
                  <div className="markdown-body max-w-4xl mx-auto pb-20">
                      <ReactMarkdown>{lessonContent}</ReactMarkdown>
                  </div>
              )}
          </div>
      </div>

      {/* Sidekick Chat (Floating or Panel) */}
      <div className={`fixed inset-y-0 right-0 w-96 bg-white shadow-2xl transform transition-transform duration-300 z-40 flex flex-col ${chatOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="p-4 bg-blue-600 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                  <i className="fas fa-robot"></i>
                  <span className="font-bold">Sidekick</span>
              </div>
              <button onClick={() => setChatOpen(false)} className="hover:text-blue-200">
                  <i className="fas fa-times"></i>
              </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
              {chatHistory.length === 0 && (
                  <div className="text-center text-slate-400 text-sm mt-10">
                      <p>I'm reading {activeModule?.title || "the syllabus"}.</p>
                      <p className="mt-2">Ask me anything!</p>
                  </div>
              )}
              {chatHistory.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-lg p-3 text-sm ${
                          msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-700'
                      }`}>
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                  </div>
              ))}
              {isChatting && (
                  <div className="flex justify-start">
                      <div className="bg-white border border-slate-200 rounded-lg p-3">
                        <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-100"></div>
                            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-200"></div>
                        </div>
                      </div>
                  </div>
              )}
              <div ref={chatEndRef} />
          </div>

          <div className="p-4 bg-white border-t border-slate-200 shrink-0">
              {chatImage && (
                  <div className="mb-2 relative inline-block">
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Image attached</span>
                      <button onClick={() => setChatImage(null)} className="ml-2 text-red-500 hover:text-red-700"><i className="fas fa-times-circle"></i></button>
                  </div>
              )}
              <div className="flex gap-2">
                   <label className="cursor-pointer text-slate-400 hover:text-blue-600 p-2">
                       <i className="fas fa-image"></i>
                       <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                   </label>
                  <input 
                    type="text" 
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Ask a question..."
                    className="flex-1 bg-slate-100 border-none rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <button 
                    onClick={handleSendMessage}
                    disabled={isChatting || (!chatInput && !chatImage)}
                    className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                      <i className="fas fa-paper-plane"></i>
                  </button>
              </div>
          </div>
      </div>

      {/* Chat Toggle Button */}
      {!chatOpen && (
          <button 
            onClick={() => setChatOpen(true)}
            className="fixed bottom-6 right-6 bg-blue-600 text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center hover:bg-blue-700 transition z-30"
          >
              <i className="fas fa-comment-alt text-xl"></i>
          </button>
      )}

      {/* Modals */}
      <ExamModal 
        isOpen={showExam} 
        onClose={() => setShowExam(false)} 
        questions={examQuestions} 
      />
      
      {showGraph && graphData && (
           <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl w-full max-w-4xl p-4 relative">
                    <button onClick={() => setShowGraph(false)} className="absolute top-4 right-4 text-slate-500 hover:text-slate-800">
                        <i className="fas fa-times text-xl"></i>
                    </button>
                    <h2 className="text-xl font-bold mb-4">Course Knowledge Graph</h2>
                    <KnowledgeGraph data={graphData} onNodeClick={(id) => console.log(id)} />
                    <p className="text-sm text-slate-500 mt-4 text-center">Nodes represent concepts. Links represent dependencies.</p>
                </div>
           </div>
      )}

    </div>
  );
};

export default App;
