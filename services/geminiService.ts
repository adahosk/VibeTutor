import { GoogleGenAI, Type, Modality } from "@google/genai";
import { CourseStructure, ContentDepth, ExamQuestion, KnowledgeGraphData } from "../types";

const apiKey = process.env.API_KEY || ''; 
const ai = new GoogleGenAI({ apiKey });

// Helper to convert file to base64
export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove data url prefix (e.g. "data:application/pdf;base64,")
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const parseSyllabus = async (fileBase64: string): Promise<CourseStructure> => {
  const modelId = "gemini-3-pro-preview";
  
  const response = await ai.models.generateContent({
    model: modelId,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: "application/pdf",
            data: fileBase64
          }
        },
        {
          text: `Analyze this syllabus PDF. Extract the course structure into a strictly formatted JSON object. 
          The structure must include a course title, a brief description, and a list of modules. 
          Each module must have a title, a list of specific topics, and learning objectives.`
        }
      ]
    },
    config: {
      thinkingConfig: { thinkingBudget: 32768 },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          modules: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                topics: { type: Type.ARRAY, items: { type: Type.STRING } },
                learningObjectives: { type: Type.ARRAY, items: { type: Type.STRING } }
              }
            }
          }
        }
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");
  return JSON.parse(text) as CourseStructure;
};

export const generateLessonContent = async (
  syllabusBase64: string,
  moduleTitle: string,
  topics: string[],
  depth: ContentDepth
): Promise<string> => {
  const modelId = "gemini-3-pro-preview"; // Using Pro for deeper reasoning on content

  let depthInstruction = "";
  switch (depth) {
    case ContentDepth.SUMMARY:
      depthInstruction = "Provide a high-level summary with bullet points and key terms only. Be concise.";
      break;
    case ContentDepth.DEEP_DIVE:
      depthInstruction = "Provide an academic deep dive. Expand on every point with rigorous detail, examples, analogies, and theoretical background. Cite concepts where appropriate.";
      break;
    case ContentDepth.STANDARD:
    default:
      depthInstruction = "Provide a standard comprehensive lesson note. Balance clear explanations with sufficient detail.";
      break;
  }

  const response = await ai.models.generateContent({
    model: modelId,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: "application/pdf",
            data: syllabusBase64
          }
        },
        {
          text: `You are an expert tutor. Create a lesson content for the module: "${moduleTitle}".
          Focus on these topics: ${topics.join(", ")}.
          
          STYLE GUIDE:
          - Use Markdown formatting (Headers, Bold, Lists).
          - Be encouraging but academic.
          - ${depthInstruction}
          
          Based ONLY on the context of the provided syllabus, but you may expand with general knowledge to explain concepts better.`
        }
      ]
    }
  });

  return response.text || "Failed to generate content.";
};

export const generateKnowledgeGraph = async (syllabusBase64: string): Promise<KnowledgeGraphData> => {
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
            parts: [
                { inlineData: { mimeType: "application/pdf", data: syllabusBase64 } },
                { text: `Generate a knowledge graph representation of this course. 
                Identify key concepts (nodes) and their dependencies (links). 
                If Concept B requires Concept A, create a link from A to B.
                Return JSON.` }
            ]
        },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    nodes: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.STRING },
                                label: { type: Type.STRING },
                                group: { type: Type.INTEGER },
                                status: { type: Type.STRING, enum: ["locked", "available", "completed"] }
                            }
                        }
                    },
                    links: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                source: { type: Type.STRING },
                                target: { type: Type.STRING },
                                value: { type: Type.NUMBER }
                            }
                        }
                    }
                }
            }
        }
    });

    const text = response.text;
    return text ? JSON.parse(text) : { nodes: [], links: [] };
}

export const generateExam = async (syllabusBase64: string, moduleTitle: string): Promise<ExamQuestion[]> => {
    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: {
            parts: [
                { inlineData: { mimeType: "application/pdf", data: syllabusBase64 } },
                { text: `Generate a 5-question multiple choice exam for the module: "${moduleTitle}".
                Ensure questions test understanding, not just recall.
                Return strictly JSON.` }
            ]
        },
        config: {
            thinkingConfig: { thinkingBudget: 4096 },
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        id: { type: Type.INTEGER },
                        question: { type: Type.STRING },
                        options: { type: Type.ARRAY, items: { type: Type.STRING } },
                        correctAnswerIndex: { type: Type.INTEGER },
                        explanation: { type: Type.STRING }
                    }
                }
            }
        }
    });
    
    const text = response.text;
    return text ? JSON.parse(text) : [];
}

export const generateAudioLesson = async (textToSpeak: string): Promise<string | undefined> => {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: textToSpeak }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Puck' },
                },
            },
        },
    });

    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
}

export const chatWithSidekick = async (
    history: {role: string, parts: {text: string}[]}[],
    message: string,
    context: string,
    imagePart?: string
): Promise<string> => {
    const chat = ai.chats.create({
        model: "gemini-3-flash-preview",
        history: history,
        config: {
            systemInstruction: `You are a helpful, academic 'Sidekick' tutor. 
            The user is currently studying this content: --- ${context.substring(0, 5000)}... --- 
            Answer their questions based on this context. 
            If they ask to "Quiz me", generate 3 brief questions.
            If they upload an image, analyze it in the context of the course.`
        }
    });

    const parts: any[] = [{ text: message }];
    if (imagePart) {
        parts.push({
            inlineData: {
                mimeType: "image/jpeg",
                data: imagePart
            }
        });
    }

    const result = await chat.sendMessage({ parts });
    return result.response.text || "I couldn't understand that.";
}
