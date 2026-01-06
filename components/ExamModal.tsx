import React, { useState } from 'react';
import { ExamQuestion } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  questions: ExamQuestion[];
}

const ExamModal: React.FC<Props> = ({ isOpen, onClose, questions }) => {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSelect = (qId: number, optionIdx: number) => {
    if (submitted) return;
    setAnswers(prev => ({ ...prev, [qId]: optionIdx }));
  };

  const calculateScore = () => {
    let score = 0;
    questions.forEach(q => {
      if (answers[q.id] === q.correctAnswerIndex) score++;
    });
    return score;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
          <h2 className="text-xl font-bold text-slate-800">Midterm Simulator</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="p-6 space-y-8 flex-1 overflow-y-auto">
          {questions.map((q, idx) => (
            <div key={q.id} className="space-y-3">
              <p className="font-semibold text-lg text-slate-800">{idx + 1}. {q.question}</p>
              <div className="space-y-2">
                {q.options.map((opt, oIdx) => {
                  let btnClass = "w-full text-left p-3 rounded-lg border transition-colors ";
                  if (!submitted) {
                    btnClass += answers[q.id] === oIdx 
                      ? "border-blue-500 bg-blue-50 text-blue-700" 
                      : "border-gray-200 hover:bg-gray-50";
                  } else {
                    if (oIdx === q.correctAnswerIndex) {
                      btnClass += "border-green-500 bg-green-50 text-green-700";
                    } else if (answers[q.id] === oIdx) {
                      btnClass += "border-red-500 bg-red-50 text-red-700";
                    } else {
                      btnClass += "border-gray-200 opacity-50";
                    }
                  }

                  return (
                    <button
                      key={oIdx}
                      onClick={() => handleSelect(q.id, oIdx)}
                      className={btnClass}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              {submitted && (
                <div className="bg-slate-50 p-3 rounded text-sm text-slate-600 mt-2">
                  <span className="font-bold">Explanation:</span> {q.explanation}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="p-6 border-t border-gray-100 bg-slate-50 rounded-b-xl flex justify-between items-center">
            {submitted ? (
                 <div className="text-lg font-bold">
                    Score: {calculateScore()} / {questions.length}
                 </div>
            ) : (
                <div className="text-sm text-gray-500">Answer all questions to submit</div>
            )}
          
          {!submitted ? (
             <button
                onClick={() => setSubmitted(true)}
                disabled={Object.keys(answers).length !== questions.length}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
             >
                Submit Exam
             </button>
          ) : (
             <button
                onClick={onClose}
                className="bg-gray-800 text-white px-6 py-2 rounded-lg font-medium hover:bg-gray-900"
             >
                Close
             </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExamModal;
