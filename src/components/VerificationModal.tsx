import React, { useState } from 'react';
import { X, CheckCircle, Clock, AlertCircle, MessageSquare } from 'lucide-react';
import { Submission, SubmissionStatus, SUBMISSION_STATUS_LABELS } from '../types';
import { dataService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';

interface VerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  submission: Submission | null;
  studentName: string;
  homeworkTitle: string;
  onVerified: () => void;
}

export const VerificationModal: React.FC<VerificationModalProps> = ({
  isOpen,
  onClose,
  submission,
  studentName,
  homeworkTitle,
  onVerified,
}) => {
  const { currentUser, showToast } = useAuth();
  const [status, setStatus] = useState<SubmissionStatus>(submission?.status || 'DONE');
  const [comment, setComment] = useState(submission?.teacherComment || '');

  if (!isOpen || !submission) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    dataService.verifySubmission(currentUser, submission.submissionId, status, comment.trim());
    showToast('success', 'Баталгаажлаа', `${studentName} сурагчийн даалгаврыг шалгалаа.`);
    onVerified();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-fadeIn">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Даалгавар шалгаж баталгаажуулах</h3>
            <p className="text-xs text-slate-500">{studentName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
            <div className="text-[11px] text-slate-500 font-medium">Даалгавар:</div>
            <div className="font-bold text-slate-900 text-xs">{homeworkTitle}</div>
            {submission.studentNote && (
              <div className="pt-2 text-[11px] text-slate-600 border-t border-slate-200 mt-2">
                <span className="font-semibold text-slate-700">Сурагчийн тайлбар:</span> {submission.studentNote}
              </div>
            )}
            {submission.studentAttachmentUrl && (
              <div className="pt-1 text-[11px] text-blue-600">
                <a href={submission.studentAttachmentUrl} target="_blank" rel="noreferrer" className="underline">
                  Хавсаргасан холбоос / файл үзэх
                </a>
              </div>
            )}
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Гүйцэтгэлийн үнэлгээ (Төлөв):
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setStatus('EXCELLENT')}
                className={`p-2.5 rounded-lg border text-left font-medium transition-all ${
                  status === 'EXCELLENT' || status === 'DONE'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  Маш сайн
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Бүрэн, зөв гүйцэтгэсэн</div>
              </button>

              <button
                type="button"
                onClick={() => setStatus('AVERAGE')}
                className={`p-2.5 rounded-lg border text-left font-medium transition-all ${
                  status === 'AVERAGE' || status === 'IN_PROGRESS' || status === 'LATE'
                    ? 'border-amber-600 bg-amber-50 text-amber-800 ring-1 ring-amber-600'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  Дунд
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Хэсэгчлэн хийсэн</div>
              </button>

              <button
                type="button"
                onClick={() => setStatus('NOT_DONE')}
                className={`p-2.5 rounded-lg border text-left font-medium transition-all ${
                  status === 'NOT_DONE'
                    ? 'border-rose-600 bg-rose-50 text-rose-800 ring-1 ring-rose-600'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <X className="w-3.5 h-3.5 text-rose-600" />
                  Хийгээгүй
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Огт хийгээгүй</div>
              </button>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
              Багшийн үнэлгээ, санал сэтгэгдэл (Сурагчид харагдана):
            </label>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Жишээ: 15-р бодлогын хялбарчлалыг маш сайн хийсэн. Бодолт цэвэрхэн байна."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Буцах
            </button>
            <button
              type="submit"
              className="px-4 py-2 font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors"
            >
              Баталгаажуулах
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
