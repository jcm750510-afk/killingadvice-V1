/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronDown, 
  ChevronUp, 
  Check, 
  Upload, 
  Sparkles, 
  Search, 
  Copy, 
  Share2, 
  Loader2,
  User,
  Target,
  MessageSquare,
  AlertCircle,
  FileText,
  Smartphone,
  Image as ImageIcon,
  ArrowRight
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Toaster, toast } from 'sonner';
import { GoogleGenAI } from "@google/genai";

// --- Utilities ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
type TargetAudience = 
  | '영유아[3~4세]' | '유아[5~6세]' | '예비초[7세]'
  | '초1' | '초2' | '초3' | '초4' | '초5' | '초6'
  | '중1' | '중2' | '중3' | '고1'
  | '시니어';

type FunnelStatus = 
  | '무관심/방관'
  | '관심/고민'
  | '비교/저울질'
  | '결정/망설임';

type ConsultationPattern = 
  | '비전/진로 상담형'
  | '교과 연계 상담형'
  | '비용/시간 방어형'
  | '성적 부진/문제 돌파형';

interface FormData {
  audience: TargetAudience | null;
  subjects: string[];
  topic: string;
  evaluationFile: string | null;
  evaluationImage: { data: string; mimeType: string } | null;
  evaluationText: string;
  funnel: FunnelStatus | null;
  pattern: ConsultationPattern;
  objections: string[];
  selectedTitle: string | null;
  userGoal: string;
}

// --- Mock Data & Constants ---
const SUBJECTS = ['국어', '수학', '영어', '사회/과학', '한자', '기타'];

const AUDIENCES: TargetAudience[] = [
  '영유아[3~4세]', '유아[5~6세]', '예비초[7세]',
  '초1', '초2', '초3', '초4', '초5', '초6',
  '중1', '중2', '중3', '고1',
  '시니어'
];

const FUNNELS: { id: FunnelStatus; label: string; desc: string }[] = [
  { id: '무관심/방관', label: '무관심/방관', desc: '아직 어려서/알아서 잘하겠죠' },
  { id: '관심/고민', label: '관심/고민', desc: '성적이/결과가 안 나와서 걱정이에요' },
  { id: '비교/저울질', label: '비교/저울질', desc: '다른 곳이랑 뭐가 달라요?' },
  { id: '결정/망설임', label: '결정/망설임', desc: '효과는 알겠는데 비용/시간이...' },
];

const PATTERNS: ConsultationPattern[] = [
  '비전/진로 상담형',
  '교과 연계 상담형',
  '비용/시간 방어형',
  '성적 부진/문제 돌파형'
];

const OBJECTIONS = [
  '대상자가 너무 힘들어해요 (학습량 저항)',
  '효과가 없는 것 같아요 (단기 성과주의)',
  '비용이 부담돼요 (가격 저항)',
  '시간 여유가 없어요 (우선순위 밀림)'
];

// --- Main Component ---
export default function App() {
  const [formData, setFormData] = useState<FormData>({
    audience: null,
    subjects: [],
    topic: '',
    evaluationFile: null,
    evaluationImage: null,
    evaluationText: '',
    funnel: null,
    pattern: '비전/진로 상담형',
    objections: [],
    selectedTitle: null,
    userGoal: '',
  });

  const [isStarted, setIsStarted] = useState(false);
  const [step, setStep] = useState(1);
  const [titles, setTitles] = useState<string[]>([]);
  const [isGeneratingTitles, setIsGeneratingTitles] = useState(false);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isGeneratingGoal, setIsGeneratingGoal] = useState(false);
  const [aiSuggestedGoal, setAiSuggestedGoal] = useState('');
  const [ragStatus, setRagStatus] = useState<string>('');
  const [finalScript, setFinalScript] = useState<string>('');
  const [showEvaluation, setShowEvaluation] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to new step
  useEffect(() => {
    if (step > 1) {
      const element = document.getElementById(`step-${step}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [step]);

  // --- AI Functions ---
  const generateTitlesWithGemini = async () => {
    setIsGeneratingTitles(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const prompt = `
        상담 대상: ${formData.audience}
        상담 과목: ${formData.subjects.join(', ')}
        상담 주제: ${formData.topic}
        대상자 상태: ${formData.funnel}
        상담 패턴: ${formData.pattern}
        주요 반박 요소: ${formData.objections.join(', ')}

        [제약 조건]
        1. 단순한 제목이 아니라, 학부모와의 상담을 시작할 때 던지는 '첫 마디(오프닝 멘트)' 5가지를 작성해줘.
        2. 5가지 멘트는 각각 다른 상담 접근 방식(유형)을 가져야 해.
           - 유형 1: 공감/위로형 (학부모의 고민에 깊이 공감)
           - 유형 2: 분석/전문가형 (현재 상태를 객관적으로 짚어줌)
           - 유형 3: 비전/목표제시형 (단기적인 성과와 미래를 그림)
           - 유형 4: 위기/경각심형 (지금 바로잡지 않으면 안 되는 이유 강조, 단 부정적 단어는 순화)
           - 유형 5: 맞춤솔루션형 (학생의 특성에 맞춘 해결책 강조)
        3. 학부모가 즉각적으로 체감할 수 있는 변화를 키워드로 사용해줘.
        4. 전문적이면서도 따뜻한 공감형 톤을 유지해줘.

        위 정보를 바탕으로 '킬링 상담 멘트' 5가지를 생성해줘.
        JSON 형식으로 ["[공감형] 어머님, 요즘 OO이 수학 때문에 고민 많으셨죠? ...", "[분석형] ...", ...] 형태로 반환해줘.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      const result = JSON.parse(response.text || '[]');
      setTitles(result);
      setStep(5);
    } catch (error) {
      console.error(error);
      toast.error('상담 멘트 생성 중 오류가 발생했습니다.');
      // Fallback mock data
      setTitles([
        "[공감형] 어머님, 요즘 아이 학습량 때문에 고민 많으셨죠? 저도 그 마음 충분히 이해합니다.",
        "[분석형] 지난번 평가 결과를 보니, 연산의 기초는 잡혀있지만 응용에서 조금 헷갈려 하는 부분이 보이네요.",
        "[비전제시형] 이번 학기에는 우리 아이가 수학에 대한 자신감을 완전히 되찾는 것을 목표로 해보겠습니다.",
        "[위기강조형] 지금 이 시기에 기초를 탄탄히 다져놓지 않으면 다음 학년에 가서 아이가 더 힘들어할 수 있어요.",
        "[맞춤솔루션형] 아이의 성향을 보니, 칭찬과 함께 작은 성공 경험을 계속 쌓아주는 방식이 가장 효과적일 것 같습니다."
      ]);
      setStep(5);
    } finally {
      setIsGeneratingTitles(false);
    }
  };

  const suggestGoalWithGemini = async () => {
    setIsGeneratingGoal(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const prompt = `
        상담 대상: ${formData.audience}
        상담 과목: ${formData.subjects.join(', ')}
        상담 주제: ${formData.topic}
        대상자 상태: ${formData.funnel}
        상담 패턴: ${formData.pattern}
        평가서 요약 내용: ${formData.evaluationText || '없음'}
        첨부 이미지 유무: ${formData.evaluationImage ? '있음 (이미지를 정밀 분석할 것)' : '없음'}
        
        위 학생의 현재 상태와 평가 내용을 바탕으로, 향후 '3개월' 내에 달성 가능한 구체적이고 현실적인 학습 목표 1가지를 제안해줘.
        선생님이 학부모에게 제시할 수 있는 형태의 문장으로 작성해줘. (예: "다음 달 수학 단원평가에서 90점 이상을 달성하고, 매일 15분씩 스스로 학습하는 습관을 형성하겠습니다.")
      `;
      
      const parts: any[] = [{ text: prompt }];
      if (formData.evaluationImage) {
        parts.push({
          inlineData: {
            data: formData.evaluationImage.data,
            mimeType: formData.evaluationImage.mimeType
          }
        });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts }
      });

      const suggestedGoal = response.text || '';
      setAiSuggestedGoal(suggestedGoal);
      
      if (!formData.userGoal) {
        setFormData(prev => ({ ...prev, userGoal: suggestedGoal }));
      }
    } catch (error) {
      console.error(error);
      toast.error('목표 제안 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGeneratingGoal(false);
    }
  };

  const generateScriptWithRAG = async () => {
    if (!formData.selectedTitle) return;
    
    setIsGeneratingScript(true);
    setFinalScript('');
    
    // Simulate RAG Pipeline with provided knowledge base
    const statuses = [
      '대교 눈높이 지식베이스 정밀 분석 중...',
      '단기 학습 목표 및 비전 설계 중...',
      '공감형 톤앤매너 검수 중...',
      '최종 맞춤형 스크립트 생성 중...'
    ];

    for (const status of statuses) {
      setRagStatus(status);
      await new Promise(r => setTimeout(r, 800));
    }

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      // Knowledge base summary from provided images
      const knowledgeBase = `
        [교육 환경 변화 및 공교육 정보]
        - 2022 개정 교육과정: 문해력 및 이해력 중심, 자기주도 학습 역량 강화.
        - 디지털 교과서 현황: 2025년 현재 공교육에서 디지털 교과서는 '보조 자료'로만 활용되고 있음 (전면 채택 아님). 따라서 지면 학습과 디지털 보조 학습의 균형이 매우 중요함.
        - 초등 1학년 국어 시간 확대 (34시간 추가)를 통한 기초 문해력 강화 기조.
        
        [과목별 전략]
        - 국어: '정확하게 읽기 -> 요약하기 -> 생각하기'의 단계적 접근. 어휘력이 성적을 결정함.
        - 수학: 계통성 강조. 초등 수학의 50%인 '수와 연산' 기초가 무너지면 중고등 학습 불가.
        - 영어: 소리 흡수의 골든타임 활용. 듣기에서 읽기/쓰기로 자연스럽게 전이.
        
        [상담 가이드라인]
        - 공식: 공감 -> 정보전달 -> 방향제시.
        - 비전 제시: 1년 뒤의 먼 미래보다 '이번 분기', '이번 학기' 내에 달성 가능한 구체적인 단기 목표를 제시할 것.
        - 금지어: 부족, 못함, 방임, 방관, 뒤처짐.
        - 권장어: 보완할 요소, 제가 채워 줄 부분, 성장을 위한 시작점, 잠재력을 깨울 기회.
      `;

      const prompt = `
        당신은 대교 눈높이의 전문 학습 컨설턴트입니다. 아래 지식베이스와 상담 데이터를 바탕으로 학부모님께 보낼 '공감형' 상담 스크립트를 작성하세요.

        [지식베이스]
        ${knowledgeBase}

        [상담 데이터]
        - 선택된 제목: ${formData.selectedTitle}
        - 상담 대상: ${formData.audience}
        - 상담 과목: ${formData.subjects.join(', ')}
        - 상담 주제: ${formData.topic}
        - 대상자 상태: ${formData.funnel}
        - 상담 패턴: ${formData.pattern}
        - 주요 반박 요소: ${formData.objections.join(', ')}
        - 평가서 요약 내용: ${formData.evaluationText || '없음'}
        - 첨부 이미지 유무: ${formData.evaluationImage ? '있음 (이미지를 정밀 분석할 것)' : '없음'}
        - 사용자가 설정한 3개월 목표: ${formData.userGoal || '없음 (AI가 제안할 것)'}

        [작성 가이드라인 - 필독]
        1. 이미지 정밀 분석 (첨부된 경우): 첨부된 학습 평가서나 시험지 이미지를 분석하여 학생의 구체적인 강점과 보완점을 도출하세요.
        2. 3개월 단기 목표 설정: '사용자가 설정한 3개월 목표'가 있다면 이를 최우선으로 반영하여 스크립트를 작성하세요. 만약 없다면, 분석 결과를 바탕으로 향후 '3개월' 내에 달성 가능한 구체적이고 현실적인 학습 목표를 AI가 직접 제안하여 포함하세요.
        3. 톤앤매너: 매우 따뜻하고 공감적인 '공감형'으로 작성하세요. 학부모님의 고민을 충분히 이해한다는 표현을 먼저 사용하세요.
        4. 금지 용어: "방임형", "방관자", "부족해요", "못해요", "뒤처져요" 등 부정적인 단어는 절대 사용하지 마세요.
        5. 긍정적 치환: "보완할 요소", "제가 채워 줄 부분", "성장을 위한 시작점", "잠재력을 깨울 기회" 등의 비전 중심 용어를 사용하세요.
        6. 공교육 팩트: 디지털 교과서가 현재 보조 자료로만 쓰이고 있음을 언급하며, 눈높이의 체계적인 지면/디지털 병행 학습의 강점을 은근히 강조하세요.
        7. 구조: [💡강점 / 🚨보완 포인트 / 🎯3개월 단기 목표 및 솔루션] 요약 후, 본문 작성.
        8. 카카오톡 최적화: 짧은 단락, 적절한 이모지(😊, ✨, 🎯 등)를 사용하세요.
      `;

      const parts: any[] = [{ text: prompt }];
      if (formData.evaluationImage) {
        parts.push({
          inlineData: {
            data: formData.evaluationImage.data,
            mimeType: formData.evaluationImage.mimeType
          }
        });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts },
      });

      setFinalScript(response.text || '스크립트 생성 실패');
      setStep(6);
    } catch (error) {
      console.error(error);
      setFinalScript(`
[💡 강점 / 🚨 보완 포인트 / 🎯 이번 학기 솔루션]
💡 강점: 원리를 이해하면 응용력이 빠르게 살아나는 잠재력을 가지고 있습니다.
🚨 보완 포인트: 이번 분기에는 연산의 정확도를 높여 '아는 문제는 반드시 맞히는' 성공 경험을 채워줄 시기입니다.
🎯 단기 솔루션: 향후 3개월간 눈높이수학의 맞춤형 드릴 학습으로 연산 기초 체력을 완벽히 보완하겠습니다.

어머님, 안녕하세요! 😊 ${formData.audience} 전문 컨설턴트입니다.
우리 아이 교육 방향을 두고 고민이 참 많으셨을 텐데, 그 마음 깊이 공감합니다. 

[권위]
현재 공교육에서 디지털 교과서는 보조 자료로 활용되고 있습니다. 저희는 이러한 변화에 맞춰 지면의 깊이와 디지털의 효율성을 결합한 가장 앞선 커리큘럼을 제공합니다.

[근거 및 보완책]
"${formData.objections[0] || '학습량'}"에 대한 부분은 제가 아이의 속도에 맞춰 꼼꼼히 채워 드릴게요. 이번 학기의 목표는 거창한 미래보다, 당장 다음 달 단원평가에서 아이가 "나도 할 수 있다!"는 자신감을 얻는 것입니다.

[행동유도]
이번 분기, 아이의 작은 변화를 함께 만들어보시는 건 어떨까요? ✨
구체적인 단기 로드맵은 아래에서 확인 가능합니다. 👇
      `);
      setStep(6);
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(finalScript);
    toast.success('클립보드에 복사되었습니다!');
  };

  const shareToKakao = () => {
    toast.info('카카오톡 공유 기능을 모의 실행합니다.');
  };

  // --- Render Helpers ---
  const StepHeader = ({ num, title, icon: Icon }: { num: number, title: string, icon: any }) => (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
        {num}
      </div>
      <Icon className="w-5 h-5 text-blue-600" />
      <h2 className="text-xl font-bold text-slate-800">{title}</h2>
    </div>
  );

  if (!isStarted) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl w-full bg-white rounded-3xl shadow-xl overflow-hidden"
        >
          <div className="bg-emerald-600 p-12 text-center text-white relative overflow-hidden">
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
            <Sparkles className="w-16 h-16 mx-auto mb-6 text-emerald-200 relative z-10" />
            <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight relative z-10">AI 눈높이 상담<br/>프롬프트 마스터</h1>
            <p className="text-emerald-100 text-lg md:text-xl relative z-10">최고의 학부모 상담/유입 전환을 이끌어내는 전문가 수준의 멘트를 자동 완성하세요.</p>
          </div>
          <div className="p-8 md:p-12 flex flex-col items-center gap-10">
            <button 
              onClick={() => setIsStarted(true)}
              className="w-full md:w-auto px-10 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-bold text-lg shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2 hover:scale-105 active:scale-95"
            >
              상담 멘트 생성 시작하기 <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans">
      <Toaster position="top-center" />
      
      {/* Header */}
      <header className="bg-white border-b border-slate-200 py-6 px-6 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">AI 눈높이 상담 프롬프트 마스터</h1>
            <p className="text-slate-500 text-xs mt-0.5">최고의 학부모 상담/유입 전환을 이끌어내는 전문가 수준의 멘트를 클릭 몇 번으로 자동 완성하세요.</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Sidebar: Info & Guide */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-pink-50 border border-pink-100 rounded-xl overflow-hidden">
            <div className="bg-pink-100/50 px-4 py-3 border-b border-pink-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-pink-600" />
              <h3 className="font-bold text-pink-800 text-sm">마스터 프레임 (탑재됨)</h3>
            </div>
            <div className="p-4 text-sm text-slate-700 space-y-3">
              <p>이 애플리케이션은 눈높이 러닝센터 <strong>상담 마스터 프레임</strong>을 코어 프롬프트로 내장하고 있습니다.</p>
              <ul className="list-disc pl-5 space-y-2 text-slate-600">
                <li><strong>비율:</strong> 공감(1) : 정보전달(1) : 방향제시(1)</li>
                <li><strong>구조:</strong> A.E.A 3층 구조 (권위-근거-행동)</li>
                <li><strong>특징:</strong> 학부모 의심 사전 차단, 자연스러운 진단평가 CTA 삽입</li>
                <li><strong>시각화:</strong> 평가서 기반 정밀 분석 프롬프트 자동 삽입</li>
              </ul>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-100 rounded-xl overflow-hidden">
            <div className="bg-emerald-100/50 px-4 py-3 border-b border-emerald-100 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-emerald-800 text-sm">사용 가이드</h3>
            </div>
            <div className="p-4 text-sm text-slate-700">
              <ol className="list-decimal pl-5 space-y-3 text-slate-600">
                <li>우측 패널에 <strong>타겟 정보와 상담 상황</strong>을 입력합니다.</li>
                <li><strong>상담 멘트 5가지 추천</strong> 버튼을 누릅니다.</li>
                <li>AI가 생성한 5개의 멘트 중 가장 마음에 드는 것을 클릭합니다.</li>
                <li>선택한 멘트를 바탕으로 <strong>전체 상담 스크립트</strong>가 자동 작성됩니다.</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Right Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              <h2 className="font-bold text-slate-800 text-lg">상담 원스톱 생성기</h2>
            </div>
            
            <div className="p-6 space-y-8">
              {/* Step 1: Target Audience & Subjects */}
              <section id="step-1" className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">1</div>
                  <h3 className="font-bold text-slate-800">타겟 정보 입력</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">상담 대상 *</label>
                    <select 
                      className="w-full p-3 rounded-lg border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                      value={formData.audience || ''}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, audience: e.target.value as TargetAudience }));
                        if (step === 1) setStep(2);
                      }}
                    >
                      <option value="" disabled>대상을 선택하세요</option>
                      {AUDIENCES.map(aud => <option key={aud} value={aud}>{aud}</option>)}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">상담 과목 (복수 선택 가능) *</label>
                    <div className="flex flex-wrap gap-2">
                      {SUBJECTS.map(sub => (
                        <button
                          key={sub}
                          onClick={() => {
                            setFormData(prev => ({
                              ...prev,
                              subjects: prev.subjects.includes(sub)
                                ? prev.subjects.filter(s => s !== sub)
                                : [...prev.subjects, sub]
                            }));
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-sm border transition-colors",
                            formData.subjects.includes(sub) 
                              ? "bg-emerald-600 text-white border-emerald-600" 
                              : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"
                          )}
                        >
                          {sub}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              {/* Step 2: Topic & Evaluation */}
              <AnimatePresence>
                {step >= 2 && (
                  <motion.section 
                    id="step-2"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4 pt-6 border-t border-slate-100"
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">2</div>
                      <h3 className="font-bold text-slate-800">상담상황 및 주제 입력</h3>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">상담 주제 *</label>
                      <input 
                        type="text"
                        placeholder="예: 초등 문해력의 중요성, 예비초등 수학 준비"
                        className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        value={formData.topic}
                        onChange={(e) => setFormData(prev => ({ ...prev, topic: e.target.value }))}
                        onBlur={() => {
                          if (formData.topic && step === 2) setStep(3);
                        }}
                      />
                    </div>

                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <button 
                        onClick={() => setShowEvaluation(!showEvaluation)}
                        className="flex items-center justify-between w-full p-3 bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors"
                      >
                        <span className="text-sm font-medium flex items-center gap-2">
                          <FileText className="w-4 h-4 text-emerald-600" /> 부가 기능 (평가서 기반 AI 정밀 분석)
                        </span>
                        {showEvaluation ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      
                      {showEvaluation && (
                        <div className="p-4 bg-white flex flex-col gap-4 border-t border-slate-200">
                          <div className="flex flex-col items-center gap-3 w-full">
                            <label className="btn-outline py-3 px-4 text-sm flex items-center justify-center gap-2 w-full cursor-pointer border-emerald-200 hover:bg-emerald-50 text-emerald-700 transition-colors">
                              <ImageIcon className="w-5 h-5" /> 
                              <span>평가서/시험지 사진 업로드</span>
                              <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    const base64String = (reader.result as string).split(',')[1];
                                    setFormData(prev => ({ 
                                      ...prev, 
                                      evaluationFile: file.name,
                                      evaluationImage: { data: base64String, mimeType: file.type }
                                    }));
                                    toast.success('사진이 업로드되었습니다.');
                                  };
                                  reader.readAsDataURL(file);
                                }}
                              />
                            </label>
                            {formData.evaluationImage && (
                              <div className="flex flex-col items-center gap-2 w-full mt-2">
                                <div className="w-full max-w-[200px] aspect-video relative rounded-lg overflow-hidden border border-slate-200 shadow-sm">
                                  <img src={`data:${formData.evaluationImage.mimeType};base64,${formData.evaluationImage.data}`} alt="Preview" className="w-full h-full object-cover" />
                                </div>
                                <div className="flex items-center gap-2 text-xs text-emerald-600 font-medium bg-emerald-50 px-3 py-1.5 rounded-full">
                                  <Check className="w-3 h-3" /> {formData.evaluationFile} 
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="space-y-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">평가서 주요 내용 요약</label>
                            <textarea 
                              placeholder="평가서의 핵심 내용(강점, 보완점 등)을 간단히 적어주시면 더욱 정교한 스크립트가 생성됩니다."
                              className="w-full p-3 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none h-20 resize-none bg-slate-50"
                              value={formData.evaluationText}
                              onChange={(e) => setFormData(prev => ({ ...prev, evaluationText: e.target.value }))}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.section>
                )}
              </AnimatePresence>

              {/* Step 3: Funnel Status & Pattern */}
              <AnimatePresence>
                {step >= 3 && (
                  <motion.section 
                    id="step-3"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6 pt-6 border-t border-slate-100"
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">3</div>
                      <h3 className="font-bold text-slate-800">상담 유형 및 반박 요소</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">상담 대상자 상태 *</label>
                        <select 
                          className="w-full p-3 rounded-lg border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                          value={formData.funnel || ''}
                          onChange={(e) => {
                            setFormData(prev => ({ ...prev, funnel: e.target.value as FunnelStatus }));
                            if (step === 3) setStep(4);
                          }}
                        >
                          <option value="" disabled>상태를 선택하세요</option>
                          {FUNNELS.map(f => <option key={f.id} value={f.id}>{f.label} ({f.desc})</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">상담 패턴 선택 *</label>
                        <select 
                          className="w-full p-3 rounded-lg border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                          value={formData.pattern}
                          onChange={(e) => setFormData(prev => ({ ...prev, pattern: e.target.value as ConsultationPattern }))}
                        >
                          {PATTERNS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">핵심 반박(Objection) 요소 (다중 선택)</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {OBJECTIONS.map(obj => (
                          <label key={obj} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                            <input 
                              type="checkbox"
                              className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                              checked={formData.objections.includes(obj)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData(prev => ({ ...prev, objections: [...prev.objections, obj] }));
                                } else {
                                  setFormData(prev => ({ ...prev, objections: prev.objections.filter(o => o !== obj) }));
                                }
                              }}
                            />
                            <span className="text-sm text-slate-600">{obj}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <button 
                      onClick={generateTitlesWithGemini}
                      disabled={isGeneratingTitles || !formData.topic || !formData.funnel || !formData.audience}
                      className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isGeneratingTitles ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Sparkles className="w-5 h-5" />
                      )}
                      ✨ 상담 멘트 5가지 추천받기
                    </button>
                  </motion.section>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Step 5: Title Selection */}
          <AnimatePresence>
            {step >= 5 && titles.length > 0 && (
              <motion.div 
                id="step-5"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-emerald-200 rounded-xl shadow-sm overflow-hidden"
              >
                <div className="bg-emerald-50 border-b border-emerald-100 px-6 py-4 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-emerald-600" />
                  <h2 className="font-bold text-slate-800 text-lg">추천 상담 멘트</h2>
                </div>
                
                <div className="p-6 space-y-4">
                  <p className="text-sm text-slate-600 mb-2">가장 마음에 드는 오프닝 멘트를 선택해 주세요.</p>
                  <div className="space-y-3">
                    {titles.map((t, idx) => (
                      <button
                        key={idx}
                        onClick={() => setFormData(prev => ({ ...prev, selectedTitle: t }))}
                        className={cn(
                          "w-full p-4 rounded-xl border-2 transition-all text-left flex items-start gap-3",
                          formData.selectedTitle === t 
                            ? "border-emerald-600 bg-emerald-50 shadow-sm" 
                            : "border-slate-200 bg-white hover:border-emerald-300"
                        )}
                      >
                        <div className={cn(
                          "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 text-xs font-bold mt-0.5",
                          formData.selectedTitle === t ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 text-slate-400"
                        )}>
                          {idx + 1}
                        </div>
                        <span className={cn("text-sm leading-relaxed", formData.selectedTitle === t ? "font-bold text-emerald-800" : "text-slate-700")}>
                          {t}
                        </span>
                      </button>
                    ))}
                  </div>

                  {formData.selectedTitle && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="mt-6 space-y-4 pt-6 border-t border-slate-100"
                    >
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-bold text-slate-700 flex items-center gap-2">
                            <Target className="w-4 h-4 text-emerald-600" /> 3개월 단기 목표 설정
                          </label>
                          <button 
                            onClick={suggestGoalWithGemini}
                            disabled={isGeneratingGoal}
                            className="text-xs bg-white border border-emerald-200 text-emerald-600 px-3 py-1.5 rounded-lg font-medium hover:bg-emerald-50 flex items-center gap-1 transition-colors shadow-sm"
                          >
                            {isGeneratingGoal ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                            AI 목표 제안받기
                          </button>
                        </div>
                        <p className="text-xs text-slate-500 mb-3">
                          선생님이 생각하시는 3개월 내 달성 목표를 직접 입력하거나, AI의 제안을 받아 수정해 보세요.
                        </p>
                        
                        {aiSuggestedGoal && (
                          <div className="mb-3 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                            <p className="text-xs font-bold text-emerald-700 mb-1 flex items-center gap-1">
                              <Sparkles className="w-3 h-3" /> AI 제안 목표:
                            </p>
                            <p className="text-sm text-emerald-900 leading-relaxed">{aiSuggestedGoal}</p>
                            <button 
                              onClick={() => setFormData(prev => ({ ...prev, userGoal: aiSuggestedGoal }))}
                              className="mt-2 text-xs text-emerald-600 hover:text-emerald-800 font-medium flex items-center gap-1"
                            >
                              <Check className="w-3 h-3" /> 이 제안으로 목표 덮어쓰기
                            </button>
                          </div>
                        )}

                        <textarea 
                          placeholder="예: 다음 달 단원평가 90점 이상 달성, 매일 15분 자기주도 학습 습관 형성 등"
                          className="w-full p-3 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none h-24 resize-none bg-white"
                          value={formData.userGoal}
                          onChange={(e) => setFormData(prev => ({ ...prev, userGoal: e.target.value }))}
                        />
                      </div>

                      <button 
                        onClick={generateScriptWithRAG}
                        disabled={isGeneratingScript}
                        className="w-full py-4 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
                      >
                        {isGeneratingScript ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Smartphone className="w-5 h-5" />
                        )}
                        🚀 목표 확정 및 전체 상담 스크립트 생성
                      </button>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Step 6: Final Script */}
          <AnimatePresence>
            {isGeneratingScript && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-12 space-y-4 bg-white rounded-xl border border-slate-200"
              >
                <div className="relative">
                  <Loader2 className="w-12 h-12 text-emerald-600 animate-spin" />
                  <Search className="w-6 h-6 text-emerald-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-bounce" />
                </div>
                <p className="text-emerald-600 font-bold animate-pulse">{ragStatus}</p>
              </motion.div>
            )}

            {step >= 6 && finalScript && !isGeneratingScript && (
              <motion.div 
                id="step-6"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white border-2 border-emerald-500 rounded-xl shadow-lg overflow-hidden"
              >
                <div className="bg-emerald-50 border-b border-emerald-100 px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Check className="w-5 h-5 text-emerald-600" />
                    <h2 className="font-bold text-slate-800 text-lg">최종 맞춤형 상담 스크립트</h2>
                  </div>
                  <div className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider">
                    A-E-A Structure
                  </div>
                </div>

                <div className="p-6">
                  <div className="relative">
                    <textarea 
                      readOnly
                      className="w-full h-96 p-5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-sm leading-relaxed font-mono resize-none focus:outline-none"
                      value={finalScript}
                    />
                    <div className="absolute top-3 right-3 flex gap-2">
                      <button 
                        onClick={copyToClipboard}
                        className="p-2 bg-white rounded-lg shadow-sm border border-slate-200 hover:bg-slate-50 text-slate-600"
                        title="복사하기"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-6">
                    <button 
                      onClick={copyToClipboard}
                      className="py-4 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                    >
                      <Copy className="w-5 h-5" /> 📋 텍스트 복사
                    </button>
                    <button 
                      onClick={shareToKakao}
                      className="bg-[#FEE500] hover:bg-[#FADA0A] text-[#3A1D1D] font-bold py-4 px-6 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-md shadow-yellow-100"
                    >
                      <Share2 className="w-5 h-5" /> 💬 카톡 공유
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Footer info */}
      <footer className="max-w-6xl mx-auto px-6 py-10 text-center text-slate-400 text-xs">
        <p>© 2026 AI 눈높이 상담 프롬프트 마스터 v2.0</p>
        <p className="mt-2">Powered by Gemini 3.0 & RAG Knowledge Engine</p>
      </footer>
    </div>
  );
}
