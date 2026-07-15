'use client';

import { useState } from 'react';

// S10. FAQ — 1회 구매 모델은 구독보다 질문이 많다. 이탈 직전 반론 처리
const FAQS = [
    {
        q: '10년 후에는 어떻게 되나요?',
        a: '도입일로부터 10년간 사용하실 수 있습니다. 10년 이후에는 구독제로 전환되며, 전환 시점 6개월 전에 조건을 미리 안내드립니다.',
    },
    {
        q: '왜 선착순 100개사만 이 가격인가요?',
        a: '1회 구매·10년 사용 조건은 초기 도입 기업에 드리는 특별가로, 100번째 기업까지만 제공됩니다. 이후에는 구독제로 전환되며, 선착순 100개사에서 마감됩니다.',
    },
    {
        q: '데이터는 어디에 저장되나요?',
        a: 'Cloudflare 글로벌 인프라에 저장되며, 회사마다 전용 서브도메인으로 완전히 격리됩니다. 저장·전송 전 구간이 암호화됩니다.',
    },
    {
        q: '기존 엑셀 명부를 옮길 수 있나요?',
        a: '네. 엑셀 직원 명부를 그대로 임포트할 수 있습니다. 부서·직급 정보와 함께 일괄 등록됩니다.',
    },
    {
        q: '환불 규정은 어떻게 되나요?',
        a: '결제 후 실제 이용을 시작하기 전이라면 환불이 가능합니다. 자세한 기준은 결제 단계에서 안내드립니다.',
    },
    {
        q: '직원 수가 플랜 인원을 넘으면요?',
        a: '상위 플랜으로 업그레이드하시면 됩니다. 차액만 결제하면 되고, 기존 데이터는 그대로 유지됩니다.',
    },
    {
        q: '업데이트도 10년간 제공되나요?',
        a: '네. 이용 기간 동안 기능 개선과 보안 업데이트가 추가 비용 없이 제공됩니다.',
    },
];

export default function FaqSection() {
    const [open, setOpen] = useState<number | null>(0);

    return (
        <section className="py-14 sm:py-24 bg-white">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-12">
                    <p className="text-brand-accent font-semibold text-sm mb-3 tracking-wide">자주 묻는 질문</p>
                    <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight" style={{ textWrap: 'balance' }}>
                        구매 전, 이런 점이 궁금하시죠
                    </h2>
                </div>

                <div className="space-y-3">
                    {FAQS.map((faq, i) => {
                        const isOpen = open === i;
                        return (
                            <div key={faq.q} className="rounded-2xl border border-gray-200 bg-gray-50 overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setOpen(isOpen ? null : i)}
                                    className="w-full flex items-center justify-between gap-4 px-5 sm:px-6 py-4 text-left"
                                    aria-expanded={isOpen}
                                >
                                    <span className="text-sm sm:text-base font-semibold text-gray-900">{faq.q}</span>
                                    <svg
                                        className={`w-5 h-5 text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        aria-hidden="true"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                                {isOpen && (
                                    <p className="px-5 sm:px-6 pb-5 text-sm text-gray-600 leading-relaxed">{faq.a}</p>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
