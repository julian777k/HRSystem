'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ALL_FEATURES } from '@/constants/features';

// 공개 데모 — 가입 없이 데모 테넌트로 자동 로그인된다
const DEMO_URL = 'https://demo.keystonehr.app/api/demo/login';

const HIGHLIGHTS = [
  {
    badge: '차별화 1',
    title: '복지 관리 — 기본 포함',
    description:
      '보통 유료 애드온으로 파는 복지 관리를 기본으로 제공합니다. 카테고리별 복지 항목 등록, 직원 신청, 관리자 승인까지 한번에.',
    screenshots: [
      { src: '/screenshots/10_welfare_catalog.png', alt: '복지 항목 목록', caption: '사원이 보는 복지 목록' },
      { src: '/screenshots/08_welfare_item_form.png', alt: '복지 항목 등록', caption: '관리자 복지 항목 등록' },
    ],
  },
  {
    badge: '차별화 2',
    title: '연장근무 보상제 — 시간으로 돌려받기',
    description:
      '연장근무 수당을 현금이 아닌 보상시간(Time Wallet)으로 적립합니다. 적립된 시간은 연차처럼 사용할 수 있어, 비용 부담 없이 직원 보상이 가능합니다.',
    screenshots: [
      { src: '/screenshots/13_overtime_request_filled.png', alt: '연장근무 신청', caption: '연장근무 신청' },
      { src: '/screenshots/15_time_wallet_balance.png', alt: '보상시간 잔액', caption: '보상시간 잔액 확인' },
      { src: '/screenshots/15b_time_wallet_usage.png', alt: '보상시간 사용', caption: '보상시간으로 휴가 신청' },
    ],
  },
  {
    badge: '차별화 3',
    title: '웹훅 자동전송 — Slack, Teams 연동',
    description:
      '매일/매주 휴무 현황을 Slack, Kakao Work, Microsoft Teams로 자동 전송합니다. 팀원 부재 파악에 별도 확인이 필요 없습니다.',
    screenshots: [
      { src: '/screenshots/17_webhook_schedule_configured.png', alt: '웹훅 설정', caption: '웹훅 스케줄 설정' },
    ],
  },
];

const CORE_FEATURES = [
  {
    title: '직원 관리',
    description: '부서, 직급별 직원 현황 관리. 클릭 한 번으로 소속 직원 조회 및 부서/직급 변경.',
    screenshot: '/screenshots/04_employee_list.png',
  },
  {
    title: '휴가 관리',
    description: '연차, 반차, 병가 등 다양한 휴가 유형. 자동 부여, 잔여일수 계산, 캘린더 뷰.',
    screenshot: '/screenshots/20_leave_calendar.png',
  },
  {
    title: '조직 관리',
    description: '부서/직급별 소속 직원 펼침 보기, 드래그 없이 Select로 간편 이동.',
    screenshot: '/screenshots/06_departments_expanded.png',
  },
];

function ClickableImage({ src, alt, width, height, className, priority, caption }: {
  src: string; alt: string; width: number; height: number; className?: string; priority?: boolean; caption?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="cursor-zoom-in" onClick={() => setOpen(true)}>
        <Image src={src} alt={alt} width={width} height={height} className={className} priority={priority} loading={priority ? undefined : 'lazy'} />
      </div>
      {open && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="이미지 확대"
          onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
          tabIndex={-1}
          ref={(el) => el?.focus()}
        >
          <div className="relative max-w-[95vw] max-h-[95vh]">
            <Image
              src={src}
              alt={alt}
              width={2880}
              height={1800}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              loading="lazy"
            />
            {caption && (
              <p className="text-white/80 text-sm text-center mt-3">{caption}</p>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(false); }}
              className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center text-gray-700 hover:bg-gray-100 shadow-lg text-lg font-bold"
              aria-label="닫기"
            >
              &times;
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// 실제 서비스 중인 웹앱임을 즉시 전달하는 브라우저 크롬 목업
function BrowserFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl overflow-hidden shadow-2xl ring-1 ring-black/5 bg-white">
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-100 border-b border-gray-200">
        <span className="w-3 h-3 rounded-full bg-red-400" />
        <span className="w-3 h-3 rounded-full bg-amber-400" />
        <span className="w-3 h-3 rounded-full bg-emerald-400" />
        <div className="flex-1 flex justify-center">
          <span className="px-4 py-1 rounded-md bg-white border border-gray-200 text-xs text-gray-400 font-medium">
            keystonehr.app
          </span>
        </div>
      </div>
      {children}
    </div>
  );
}

export default function LandingPage() {
  return (
    <main>
      {/* Hero — 첫 화면은 임팩트. 논증은 스크롤 아래에서 한다 */}
      {/* overflow는 열어둔다 — 제품 화면이 아래 섹션으로 넘어가며 이어져야 한다 */}
      <section className="relative min-h-[88vh] flex flex-col bg-surface-navy text-white">
        {/* 단일 색조가 화면을 지배하도록 깔아두는 광원 */}
        <div
          className="absolute inset-0 opacity-70 pointer-events-none"
          style={{
            background:
              'radial-gradient(80% 55% at 50% 0%, rgba(59,130,246,0.28) 0%, rgba(11,30,63,0) 70%)',
          }}
          aria-hidden="true"
        />

        <div className="relative flex-1 flex items-center justify-center px-4 sm:px-6 pt-20 sm:pt-24 pb-4">
          <div className="text-center max-w-4xl">
            <p className="text-brand-accent font-semibold text-xs sm:text-sm mb-6 sm:mb-8 tracking-[0.2em] uppercase">
              중소기업을 위한 올인원 HR
            </p>
            <h1
              className="text-5xl sm:text-7xl lg:text-8xl font-extrabold leading-[1.05] tracking-tight mb-8"
              style={{ textWrap: 'balance' }}
            >
              기능은 그대로,
              <br />
              가격은 <span className="text-brand-accent tabular-nums">1/60</span>
            </h1>
            <p className="text-lg sm:text-2xl text-slate-300 leading-relaxed mb-10">
              직원 1인당 <span className="text-white font-bold tabular-nums">월 82원</span>.
              <br className="hidden sm:block" />
              구독형 HR이 인당 월 5,000~12,000원을 받는 동안, 우리는 1회 도입으로 10년입니다.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <a
                href={DEMO_URL}
                className="px-9 py-4 bg-white text-surface-navy rounded-full font-semibold hover:bg-slate-100 transition text-center"
              >
                데모 체험하기
              </a>
              <a
                href="#proof"
                className="px-9 py-4 border border-white/25 text-white rounded-full font-semibold hover:bg-white/10 transition text-center"
              >
                근거 보기
              </a>
            </div>
            <p className="text-xs text-slate-500 mt-5">
              가입 없이 바로 둘러볼 수 있습니다
            </p>
          </div>
        </div>

        {/* 제품 화면이 다음 섹션 위로 넘어가며 이어진다 — 하단을 잘라 "더 있다"는 신호를 준다 */}
        <div className="relative z-10 w-full max-w-[1400px] mx-auto px-4 sm:px-8 -mb-16 sm:-mb-24">
          <BrowserFrame>
            <div className="max-h-[240px] sm:max-h-[420px] overflow-hidden">
              <ClickableImage
                src="/screenshots/03_dashboard.png"
                alt="KeystoneHR 관리자 콘솔"
                width={1440}
                height={900}
                className="w-full"
                priority
                caption="관리자 콘솔 — 인원, 부서, 결재 현황을 한 화면에서"
              />
            </div>
          </BrowserFrame>
        </div>
      </section>

      {/* 통합 증명 — 기능 동등성 + 가격 격차를 한 섹션에서 논증 */}
      <section id="proof" className="pt-32 sm:pt-44 pb-14 sm:pb-24 bg-white text-gray-900">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-4xl font-bold mb-4 leading-tight tracking-tight" style={{ textWrap: 'balance' }}>
              같은 기능. <span className="text-brand-primary">1/60 가격.</span>
            </h2>
            <p className="text-gray-500 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
              기능을 빼서 싸진 게 아닙니다.<br className="hidden sm:block" />
              구독형이 유료 애드온으로 파는 기능까지 전부 포함하고도, 인당 월 82원입니다.
            </p>
          </div>

          {/* 기능 동등성 — 가격 격차의 전제 */}
          <div className="grid grid-cols-2 gap-4 sm:gap-6 max-w-2xl mx-auto mb-14">
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 sm:p-6 text-center">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">구독형 (평균)</p>
              <p className="text-3xl sm:text-4xl font-bold text-gray-600 tabular-nums">
                7<span className="text-sm sm:text-base font-semibold text-gray-400"> / 13개</span>
              </p>
              <p className="text-xs text-gray-400 mt-2">나머지는 별도 결제 또는 미지원</p>
            </div>
            <div className="bg-blue-50 border-2 border-brand-primary/30 rounded-2xl p-5 sm:p-6 text-center">
              <p className="text-xs font-semibold text-brand-primary uppercase tracking-wider mb-3">KeystoneHR</p>
              <p className="text-3xl sm:text-4xl font-bold text-brand-primary tabular-nums">
                13<span className="text-sm sm:text-base font-semibold text-brand-accent"> / 13개</span>
              </p>
              <p className="text-xs text-brand-accent mt-2">전체 기능 기본 포함 · 추가 과금 0원</p>
            </div>
          </div>

          {/* 가격 격차 — 인당 월 비용 */}
          <div className="text-center mb-6">
            <p className="text-brand-primary font-semibold text-sm mb-2 tracking-wide">
              직원 1인당 월 비용 · 50명 기준
            </p>
          </div>
          <div className="max-w-2xl mx-auto space-y-3 mb-4">
            {[
              { name: 'C사', cost: 12000, width: '100%' },
              { name: 'B사', cost: 8000, width: '67%' },
              { name: 'A사', cost: 5000, width: '42%' },
            ].map((item) => (
              <div key={item.name} className="flex items-center gap-3 sm:gap-4">
                <span className="w-10 sm:w-14 text-xs sm:text-sm font-semibold text-gray-400 shrink-0">{item.name}</span>
                <div className="flex-1 h-8 sm:h-10 bg-gray-100 rounded-lg overflow-hidden">
                  <div className="h-full bg-gray-300 rounded-lg" style={{ width: item.width }} />
                </div>
                <span className="w-20 sm:w-24 text-right text-xs sm:text-sm font-semibold text-gray-600 tabular-nums shrink-0">
                  {item.cost.toLocaleString()}원
                </span>
              </div>
            ))}
            <div className="flex items-center gap-3 sm:gap-4 pt-1">
              <span className="w-10 sm:w-14 text-xs sm:text-sm font-bold text-brand-primary shrink-0">KHR</span>
              <div className="flex-1 h-8 sm:h-10 bg-gray-100 rounded-lg overflow-hidden">
                <div className="h-full bg-brand-primary rounded-lg shadow-lg shadow-brand-primary/30" style={{ width: '0.7%', minWidth: '4px' }} />
              </div>
              <span className="w-20 sm:w-24 text-right text-sm sm:text-base font-bold text-brand-primary tabular-nums shrink-0">
                82원
              </span>
            </div>
          </div>
          <p className="text-center text-xs text-gray-400 mb-16">
            * KeystoneHR = 49만원 ÷ 120개월 ÷ 50명. 구독형은 시장 평균 기준이며 서비스별로 다를 수 있습니다.
          </p>

          {/* 근거 — 3년 총비용 */}
          <div className="text-center mb-4">
            <p className="text-brand-primary font-semibold text-sm sm:text-base mb-4 tracking-wide">
              직원 20명 기준 · 3년 총비용 · VAT 별도
            </p>
            <h3 className="text-xl sm:text-2xl font-bold mb-4 leading-tight tracking-tight" style={{ textWrap: 'balance' }}>
              구독은 쌓이고, 소유는 끝납니다
            </h3>
            <p className="text-gray-500 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
              구독형은 직원이 늘수록, 해가 갈수록 비용이 쌓입니다.<br className="hidden sm:block" />
              KeystoneHR은 1회 도입으로 10년. 직원이 늘어도 플랜 안에서 추가 비용이 없습니다.
            </p>
          </div>

          {/* 3년 총비용 — 가로 막대 */}
          <div className="max-w-2xl mx-auto space-y-3 mt-8 mb-4">
            {[
              { name: 'C사', total: 864, detail: '월 24만 × 36월', width: '100%' },
              { name: 'B사', total: 576, detail: '월 16만 × 36월', width: '67%' },
              { name: 'A사', total: 360, detail: '월 10만 × 36월', width: '42%' },
            ].map((item) => (
              <div key={item.name} className="flex items-center gap-3 sm:gap-4">
                <span className="w-10 sm:w-14 text-xs sm:text-sm font-semibold text-gray-400 shrink-0">{item.name}</span>
                <div className="flex-1 h-8 sm:h-10 bg-gray-100 rounded-lg overflow-hidden">
                  <div className="h-full bg-gray-300 rounded-lg flex items-center px-3" style={{ width: item.width }}>
                    <span className="hidden sm:block text-[10px] text-gray-600 font-medium truncate">{item.detail}</span>
                  </div>
                </div>
                <span className="w-20 sm:w-24 text-right text-xs sm:text-sm font-semibold text-gray-600 tabular-nums shrink-0">
                  {item.total}만원
                </span>
              </div>
            ))}
            <div className="flex items-center gap-3 sm:gap-4 pt-1">
              <span className="w-10 sm:w-14 text-xs sm:text-sm font-bold text-brand-primary shrink-0">KHR</span>
              <div className="flex-1 h-8 sm:h-10 bg-gray-100 rounded-lg overflow-hidden">
                <div className="h-full bg-brand-primary rounded-lg shadow-lg shadow-brand-primary/30" style={{ width: '5.7%' }} />
              </div>
              <span className="w-20 sm:w-24 text-right text-sm sm:text-base font-bold text-brand-primary tabular-nums shrink-0">
                49만원
              </span>
            </div>
          </div>

          {/* Calculation note */}
          <p className="text-center text-xs text-gray-400 mb-10">
            * 구독형 = 인당 월 요금 × 20명 × 36개월. 시장 평균 기준이며, 실제 서비스별로 다를 수 있습니다.
            <br className="hidden sm:block" />
            구독형 최저가와 비교해도 3년 기준 약 311만원을 아낍니다.
          </p>

          {/* Comparison table */}
          <div className="max-w-2xl mx-auto bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden">
            <div className="grid grid-cols-3 text-center text-xs sm:text-sm font-bold border-b border-gray-200 py-3 px-2 sm:px-4">
              <span className="text-gray-400">항목</span>
              <span className="text-gray-400">구독형</span>
              <span className="text-brand-primary">KeystoneHR</span>
            </div>
            {[
              { label: '과금 방식', sub: '인당 × 매월 반복', keystone: '1회 결제, 끝' },
              { label: '직원 추가 시', sub: '인당 추가 과금', keystone: '플랜 내 무료' },
              { label: '사용 기간', sub: '해지하면 끝', keystone: '10년 사용' },
              { label: '숨은 비용', sub: '기능별 +1~3만원/월', keystone: '없음' },
              { label: '전체 기능', sub: '플랜별 제한', keystone: '모두 포함' },
            ].map((row, i) => (
              <div key={row.label} className={`grid grid-cols-3 text-center text-xs sm:text-sm py-3 sm:py-3.5 px-2 sm:px-4 ${i % 2 === 0 ? 'bg-white' : ''}`}>
                <span className="text-gray-700 font-medium text-left">{row.label}</span>
                <span className="text-gray-500 font-semibold">{row.sub}</span>
                <span className="text-brand-primary font-semibold">✓ {row.keystone}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-center mt-10">
            <a
              href="#pricing"
              className="px-8 py-3.5 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition text-center"
            >
              요금제 보기
            </a>
          </div>
        </div>
      </section>

      {/* Feature Comparison — 브릿지 */}
      <section className="py-14 sm:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-brand-accent font-semibold text-sm mb-3 tracking-wide">13개 기능, 하나씩 확인하세요</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4 tracking-tight" style={{ textWrap: 'balance' }}>
              무엇이 포함되고,<br />
              무엇이 <span className="text-warn-500">별도 결제</span>인지
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              구독형 서비스에서 기능당 월 1~3만원씩 추가 결제해야 하는 기능까지 전부 기본 포함입니다
            </p>
          </div>

          {/* Feature comparison tables — 인포그래픽 스타일 */}
          <div className="space-y-8">
            {[
              {
                category: '📋 인사 · 근태 관리',
                rows: [
                  { feat: '직원 정보 DB', desc: '입·퇴사, 인사카드 관리', a: 'yes', b: 'yes', c: 'yes', k: 'yes' },
                  { feat: '출퇴근 기록', desc: '자동 기록 · 수동 입력 지원', a: 'yes', b: 'yes', c: 'yes', k: 'yes' },
                  { feat: '연차 · 휴가 관리', desc: '자동 발생, 승인, 이월', a: 'yes', b: 'yes', c: 'yes', k: 'yes' },
                  { feat: '근태 이상 알림', desc: '지각/조퇴/무단결근 자동 감지', a: 'no', b: 'partial', c: 'yes', k: 'yes' },
                  { feat: '조직도 관리', desc: '부서/직급 체계 관리', a: 'no', b: 'yes', c: 'yes', k: 'yes' },
                ],
              },
              {
                category: '📝 전자결재 · 복지',
                rows: [
                  { feat: '전자결재 워크플로', desc: '휴가/초과근무 다단계 승인', a: 'partial', b: 'yes', c: 'yes', k: 'yes' },
                  { feat: '복지 관리', desc: '복지 항목 등록, 신청, 승인', a: 'no', b: 'no', c: 'extra', k: 'yes' },
                  { feat: '초과근무 관리', desc: '보상휴가/수당 자동 전환', a: 'no', b: 'partial', c: 'yes', k: 'yes' },
                  { feat: '보상정책 설정', desc: '배율/공제순서 커스터마이즈', a: 'no', b: 'no', c: 'partial', k: 'yes' },
                ],
              },
              {
                category: '📊 분석 · 연동',
                rows: [
                  { feat: 'HR 대시보드', desc: '인원/이직률/근태 현황판', a: 'no', b: 'extra', c: 'yes', k: 'yes' },
                  { feat: '웹훅 연동', desc: 'Slack/Kakao Work/Teams 알림', a: 'no', b: 'no', c: 'extra', k: 'yes' },
                  { feat: '데이터 내보내기', desc: '엑셀/CSV 전체 다운로드', a: 'partial', b: 'yes', c: 'yes', k: 'yes' },
                  { feat: '공휴일 자동 관리', desc: '연도별 공휴일 일괄 등록', a: 'yes', b: 'yes', c: 'yes', k: 'yes' },
                ],
              },
            ].map((section) => (
              <div key={section.category}>
                <div className="flex items-center gap-2 mb-3 mt-6 first:mt-0">
                  <span className="text-sm sm:text-base font-extrabold text-gray-700">{section.category}</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
                <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                  <table className="w-full border-collapse text-xs sm:text-sm min-w-[380px] sm:min-w-[480px]">
                    <thead>
                      <tr className="border-b-2 border-gray-200">
                        <th className="text-left text-gray-800 font-bold py-2 sm:py-3 pl-3 sm:pl-5 pr-1 sm:pr-2" style={{ width: '36%' }}>기능</th>
                        <th className="text-center text-gray-400 font-bold py-2 sm:py-3 px-0.5 sm:px-1" style={{ width: '16%' }}>A사</th>
                        <th className="text-center text-gray-400 font-bold py-2 sm:py-3 px-0.5 sm:px-1" style={{ width: '16%' }}>B사</th>
                        <th className="text-center text-gray-400 font-bold py-2 sm:py-3 px-0.5 sm:px-1" style={{ width: '16%' }}>C사</th>
                        <th className="text-center text-brand-primary font-bold py-2 sm:py-3 px-0.5 sm:px-1 relative" style={{ width: '16%' }}>
                          <span className="hidden sm:inline">KeystoneHR</span>
                          <span className="sm:hidden">KHR</span>
                          <span className="absolute top-0 left-0.5 sm:left-1 right-0.5 sm:right-1 h-[3px] bg-brand-primary rounded-b" />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.rows.map((row, i) => {
                        const icon = (v: string) => {
                          if (v === 'yes') return <span className="inline-flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-emerald-50 text-positive-600 text-xs sm:text-sm">✓</span>;
                          if (v === 'partial') return <span className="inline-flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-amber-50 text-warn-500 text-xs sm:text-sm">△</span>;
                          if (v === 'extra') return <span className="inline-flex items-center justify-center px-1 sm:px-2 py-0.5 sm:py-1 rounded-md bg-amber-50 text-warn-500 text-[9px] sm:text-[11px] font-semibold">+별도</span>;
                          return <span className="inline-flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-gray-100 text-gray-400 text-xs sm:text-sm font-semibold">✕</span>;
                        };
                        return (
                          <tr key={row.feat} className={i % 2 === 0 ? 'bg-gray-50/60' : ''}>
                            <td className="py-2 sm:py-3 pl-3 sm:pl-5 pr-1 sm:pr-2">
                              <span className="text-gray-900 font-semibold text-xs sm:text-sm">{row.feat}</span>
                              <span className="block text-[10px] sm:text-[11px] text-gray-400 mt-0.5 hidden sm:block">{row.desc}</span>
                            </td>
                            <td className="text-center py-2 sm:py-3 px-0.5 sm:px-1">{icon(row.a)}</td>
                            <td className="text-center py-2 sm:py-3 px-0.5 sm:px-1">{icon(row.b)}</td>
                            <td className="text-center py-2 sm:py-3 px-0.5 sm:px-1">{icon(row.c)}</td>
                            <td className="text-center py-2 sm:py-3 px-0.5 sm:px-1">{icon(row.k)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>

          {/* Callout */}
          <p className="mt-8 text-center text-xs text-gray-400">
            * 구독형 서비스의 &quot;+별도&quot;는 기능당 월 1~3만원이 추가되며, 필요한 기능을 모두 켜면 실제 비용은 기본료의 2~3배까지 올라갈 수 있습니다.
          </p>
        </div>
      </section>

      {/* Trust bar */}
      <section className="py-8 border-y border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-8 sm:gap-16 text-center">
            <div>
              <p className="text-2xl font-bold text-gray-900">100%</p>
              <p className="text-sm text-gray-500">전 기능 포함</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">5분</p>
              <p className="text-sm text-gray-500">초기 설정</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">10년</p>
              <p className="text-sm text-gray-500">사용 보장</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">SSL</p>
              <p className="text-sm text-gray-500">보안 인증</p>
            </div>
          </div>
        </div>
      </section>

      {/* Differentiators */}
      <section id="features" className="py-14 sm:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4" style={{ textWrap: 'balance' }}>
              KeystoneHR은 다릅니다
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              유료 애드온 없이, 중소기업에 꼭 필요한 기능을 기본으로 제공합니다
            </p>
          </div>

          <div className="space-y-24">
            {HIGHLIGHTS.map((item, i) => (
              <div
                key={item.title}
                className={`flex flex-col ${i % 2 === 1 ? 'lg:flex-row-reverse' : 'lg:flex-row'} gap-8 lg:gap-16 items-center`}
              >
                {/* Text */}
                <div className="lg:w-5/12">
                  <span className="inline-block px-3 py-1 rounded-full bg-blue-50 text-brand-primary text-xs font-semibold mb-4">
                    {item.badge}
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
                    {item.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                {/* Screenshots */}
                <div className="lg:w-7/12">
                  <div className={`grid ${item.screenshots.length >= 3 ? 'grid-cols-2 sm:grid-cols-3' : item.screenshots.length > 1 ? 'grid-cols-2' : 'grid-cols-1'} gap-3 sm:gap-4`}>
                    {item.screenshots.map((ss) => (
                      <div key={ss.alt} className="group">
                        <div className="rounded-xl overflow-hidden shadow-lg border border-gray-200 transition group-hover:shadow-xl">
                          <ClickableImage
                            src={ss.src}
                            alt={ss.alt}
                            width={720}
                            height={450}
                            className="w-full"
                            caption={ss.caption}
                          />
                        </div>
                        <p className="text-xs text-gray-400 text-center mt-2">{ss.caption}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Core Features Grid */}
      <section className="py-14 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4" style={{ textWrap: 'balance' }}>
              KeystoneHR, 기본도 탄탄합니다
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              HR 업무에 필요한 핵심 기능을 모두 갖추고 있습니다
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {CORE_FEATURES.map((feat) => (
              <div key={feat.title} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition">
                <div className="aspect-video overflow-hidden border-b border-gray-100">
                  <ClickableImage
                    src={feat.screenshot}
                    alt={feat.title}
                    width={720}
                    height={450}
                    className="w-full h-full object-cover object-top"
                    caption={feat.title}
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{feat.title}</h3>
                  <p className="text-sm text-gray-600">{feat.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Approval Workflow */}
      <section className="py-14 sm:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4 tracking-tight" style={{ textWrap: 'balance' }}>
              결재도 온라인으로
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              연장근무, 휴가, 복지 신청을 관리자가 한 화면에서 확인하고 승인합니다
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {[
              { src: '/screenshots/14_overtime_approval_list.png', alt: '결재 대기', cap: '결재 대기 — 승인/반려 즉시 처리' },
              { src: '/screenshots/14_overtime_approved.png', alt: '결재 승인', cap: '클릭 한 번으로 결재 완료' },
            ].map((s) => (
              <div key={s.alt} className="group">
                <div className="rounded-xl overflow-hidden shadow-lg border border-gray-200 transition group-hover:shadow-xl">
                  <ClickableImage src={s.src} alt={s.alt} width={1440} height={900} className="w-full" caption={s.cap} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-14 sm:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4 tracking-tight" style={{ textWrap: 'balance' }}>
              KeystoneHR 요금제
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              추가 비용 없이, 모든 기능을 하나의 플랜으로
            </p>
            {/* TODO: 셀프 온보딩 기준 안내 문구.
                크몽에서는 온보딩 세팅 대행이 포함된 649,000원으로 판매하므로,
                이 문구가 두 채널의 가격 차이를 "구성 차이"로 설명하는 유일한 장치다.
                크몽·외부 채널을 절대 언급하지 말 것 (직거래 유도로 읽힘). */}
          </div>

          <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-6">
            {/* 50명 플랜 */}
            <div className="p-8 rounded-2xl bg-white border-2 border-gray-200 shadow-lg relative overflow-hidden hover:border-blue-400 transition">
              <h3 className="text-2xl font-bold text-gray-900 mb-1">Standard</h3>
              <p className="text-gray-500 text-sm mb-6">50명 이하 중소기업</p>

              <div className="mb-2">
                <span className="text-4xl font-bold text-gray-900 tabular-nums">49</span>
                <span className="text-xl font-bold text-gray-900">만원</span>
              </div>
              <p className="text-sm text-gray-400 mb-6">1회 구매 · 10년 사용 · 최대 50명</p>

              <div className="space-y-2.5 mb-8">
                {ALL_FEATURES.map((feature) => (
                  <div key={feature} className="flex items-start gap-2 text-sm text-gray-600">
                    <svg className="w-4 h-4 text-positive-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </div>
                ))}
              </div>

              <Link
                href="/purchase?plan=standard"
                className="block w-full py-3.5 rounded-xl font-semibold transition text-center bg-brand-primary text-white hover:opacity-90 shadow-lg shadow-brand-primary/25"
              >
                구매하기
              </Link>
              <a
                href={DEMO_URL}
                className="block w-full py-3.5 rounded-xl font-semibold transition text-center border-2 border-brand-primary text-brand-primary hover:bg-blue-50 mt-3"
              >
                데모 먼저 둘러보기
              </a>
            </div>

            {/* 100명 플랜 */}
            <div className="p-8 rounded-2xl bg-white border-2 border-brand-primary shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-brand-primary text-white text-xs font-semibold px-4 py-1.5 rounded-bl-lg">
                BEST
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">Business</h3>
              <p className="text-gray-500 text-sm mb-6">100명 이하 중견기업</p>

              <div className="mb-2">
                <span className="text-4xl font-bold text-gray-900 tabular-nums">70</span>
                <span className="text-xl font-bold text-gray-900">만원</span>
              </div>
              <p className="text-sm text-gray-400 mb-6">1회 구매 · 10년 사용 · 최대 100명</p>

              <div className="space-y-2.5 mb-8">
                {ALL_FEATURES.map((feature) => (
                  <div key={feature} className="flex items-start gap-2 text-sm text-gray-600">
                    <svg className="w-4 h-4 text-positive-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </div>
                ))}
              </div>

              <Link
                href="/purchase?plan=business"
                className="block w-full py-3.5 rounded-xl font-semibold transition text-center bg-brand-primary text-white hover:opacity-90 shadow-lg shadow-brand-primary/25"
              >
                구매하기
              </Link>
              <a
                href={DEMO_URL}
                className="block w-full py-3.5 rounded-xl font-semibold transition text-center border-2 border-brand-primary text-brand-primary hover:bg-blue-50 mt-3"
              >
                데모 먼저 둘러보기
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-brand-primary">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight" style={{ textWrap: 'balance' }}>
            설치 없이, 5분이면 시작합니다
          </h2>
          <p className="text-blue-100 text-lg mb-8 max-w-2xl mx-auto">
            1회 구매로 10년 사용. 복잡한 설치 없이 바로 시작하세요.
            <br className="hidden sm:block" />
            결정 전에 데모로 직접 확인해 보세요.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <a
              href={DEMO_URL}
              className="px-8 py-3.5 bg-white text-brand-primary rounded-xl font-semibold hover:bg-blue-50 transition"
            >
              데모 체험하기
            </a>
            <Link
              href="/login"
              className="px-8 py-3.5 border border-white/30 text-white rounded-xl font-semibold hover:bg-white/10 transition"
            >
              로그인
            </Link>
          </div>
          <p className="mt-6 text-blue-200 text-sm">
            궁금한 점이 있으신가요?{' '}
            <a
              href="https://docs.google.com/forms/d/e/1FAIpQLSfegtqPf6yW27R_nyK_lCxTC46cwT5lznY_QuHvMWiZuIwK9A/viewform"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white underline underline-offset-2 hover:text-blue-100 font-semibold"
            >
              문의하기
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}
