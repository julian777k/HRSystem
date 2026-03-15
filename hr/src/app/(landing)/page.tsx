'use client';

import { useState } from 'react';
import Image from 'next/image';

const HIGHLIGHTS = [
  {
    badge: '차별화 1',
    title: '복지 관리 — 무료로 제공',
    description:
      '다른 HR 솔루션에서는 유료 애드온인 복지 관리 기능을 기본 제공합니다. 카테고리별 복지 항목 등록, 직원 신청, 관리자 승인까지 한번에.',
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

const ALL_FEATURES = [
  '직원 관리 (부서/직급/입퇴사)',
  '출퇴근 기록 및 근태 대시보드',
  '휴가 관리 (연차/반차/병가/경조사)',
  '연차 자동부여 (근로기준법 준수)',
  '다단계 결재 시스템',
  '연장근무 관리 및 보상시간 적립',
  '복지 관리 (항목 등록/신청/승인)',
  '웹훅 자동전송 (Slack/Teams/Kakao)',
  '공휴일 관리',
  '데이터 내보내기 (Excel/CSV)',
  '모바일 반응형 UI',
  '데이터 암호화 및 감사로그',
];

function ClickableImage({ src, alt, width, height, className, priority, caption }: {
  src: string; alt: string; width: number; height: number; className?: string; priority?: boolean; caption?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="cursor-zoom-in" onClick={() => setOpen(true)}>
        <Image src={src} alt={alt} width={width} height={height} className={className} priority={priority} />
      </div>
      {open && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setOpen(false)}
        >
          <div className="relative max-w-[95vw] max-h-[95vh]">
            <Image
              src={src}
              alt={alt}
              width={2880}
              height={1800}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
            {caption && (
              <p className="text-white/80 text-sm text-center mt-3">{caption}</p>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(false); }}
              className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center text-gray-700 hover:bg-gray-100 shadow-lg text-lg font-bold"
            >
              &times;
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default function LandingPage() {
  return (
    <main>
      {/* Hero */}
      <section className="py-16 sm:py-24 bg-gradient-to-b from-blue-50 via-white to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-blue-600 font-semibold text-sm mb-3 tracking-wide">
              중소기업을 위한 올인원 HR 솔루션
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              인사관리,
              <br className="sm:hidden" />{' '}
              <span className="text-blue-600">더 쉽고 스마트하게</span>
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto mb-8">
              출퇴근, 휴가, 결재, 연장근무, 복지까지.
              <br className="hidden sm:block" />
              하나의 플랫폼으로 모든 HR 업무를 관리하세요.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <a
                href="/start"
                className="px-8 py-3.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition shadow-lg shadow-blue-600/25"
              >
                7일 무료 체험 시작하기
              </a>
              <a
                href="#features"
                className="px-8 py-3.5 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition"
              >
                기능 살펴보기
              </a>
            </div>
          </div>

          {/* Hero Screenshot */}
          <div className="relative max-w-5xl mx-auto">
            <div className="rounded-xl overflow-hidden shadow-2xl border border-gray-200">
              <ClickableImage
                src="/screenshots/03_dashboard.png"
                alt="KeystoneHR 대시보드"
                width={1440}
                height={900}
                className="w-full"
                priority
                caption="사원 대시보드 — 근태, 휴가, 결재 현황 한눈에"
              />
            </div>
            {/* Mobile overlay */}
            <div className="absolute -bottom-6 -right-4 sm:right-8 w-24 sm:w-32 rounded-xl overflow-hidden shadow-xl border border-gray-200">
              <Image
                src="/screenshots/25_mobile_dashboard.png"
                alt="모바일 대시보드"
                width={390}
                height={844}
                className="w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="py-8 border-y border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-8 sm:gap-16 text-center">
            <div>
              <p className="text-2xl font-bold text-gray-900">100%</p>
              <p className="text-sm text-gray-500">기능 무제한</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">5분</p>
              <p className="text-sm text-gray-500">초기 설정</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">0원</p>
              <p className="text-sm text-gray-500">추가 비용</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">SSL</p>
              <p className="text-sm text-gray-500">보안 인증</p>
            </div>
          </div>
        </div>
      </section>

      {/* Price Comparison — 가격 경쟁력 먼저 */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-6">
            <p className="text-blue-600 font-semibold text-sm mb-3 tracking-wide">
              매달 나가는 구독료, 언제까지 내실 건가요?
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              구독형 vs <span className="text-blue-600">1회 구매</span> 비용 비교
            </h2>
          </div>

          {/* Calculation basis tags */}
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-12">
            <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 text-sm font-medium px-4 py-2 rounded-full border border-gray-200">
              <span className="text-base">👥</span> 직원 <strong className="text-gray-900">20명</strong> 기준
            </span>
            <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 text-sm font-medium px-4 py-2 rounded-full border border-gray-200">
              <span className="text-base">📅</span> <strong className="text-gray-900">3년(36개월)</strong> 누적
            </span>
            <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 text-sm font-medium px-4 py-2 rounded-full border border-gray-200">
              <span className="text-base">💰</span> VAT 별도
            </span>
          </div>

          {/* Bar Chart */}
          <div className="flex items-end justify-center gap-3 sm:gap-6 mb-4" style={{ height: 300 }}>
            {[
              { name: 'A사', total: 360, perPerson: '5,000', monthly: 10, height: '42%', color: 'bg-slate-300' },
              { name: 'B사', total: 576, perPerson: '8,000', monthly: 16, height: '67%', color: 'bg-red-400' },
              { name: 'C사', total: 864, perPerson: '12,000', monthly: 24, height: '100%', color: 'bg-red-600' },
            ].map((item) => (
              <div key={item.name} className="flex flex-col items-center flex-1 max-w-[160px]">
                <p className="text-xl sm:text-2xl font-black text-gray-700 mb-1">{item.total}<span className="text-sm font-bold">만원</span></p>
                <div className={`w-full rounded-t-xl ${item.color} relative`} style={{ height: item.height }}>
                  <span className="absolute inset-0 flex items-center justify-center text-white/90 text-[11px] sm:text-xs font-medium leading-tight text-center px-1">
                    월 {item.monthly}만원<br />× 36개월
                  </span>
                </div>
                <div className="mt-3 text-center">
                  <p className="font-bold text-gray-800 text-sm sm:text-base">{item.name}</p>
                  <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">
                    인당 월 {item.perPerson}원
                  </p>
                  <p className="text-[10px] text-gray-300 mt-0.5">
                    {item.perPerson}원 × 20명 = 월 {item.monthly}만원
                  </p>
                </div>
              </div>
            ))}
            <div className="flex flex-col items-center flex-1 max-w-[160px]">
              <p className="text-xl sm:text-2xl font-black text-blue-600 mb-1">49<span className="text-sm font-bold">만원</span></p>
              <div className="w-full rounded-t-xl bg-blue-600 shadow-lg shadow-blue-600/30 relative" style={{ height: '5.7%' }}>
              </div>
              <div className="mt-3 text-center">
                <p className="font-bold text-blue-600 text-sm sm:text-base">KeystoneHR</p>
                <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">
                  1회 결제 · 인원 무제한
                </p>
                <p className="text-[10px] text-gray-300 mt-0.5">
                  추가 과금 0원
                </p>
              </div>
            </div>
          </div>

          {/* Calculation note */}
          <p className="text-center text-xs text-gray-400 mb-8">
            * 구독형 비용 = 인당 월 요금 × 20명 × 36개월. 시장 평균 기준이며, 실제 서비스별로 다를 수 있습니다.
          </p>

          {/* Savings badge */}
          <div className="flex justify-center mb-10">
            <div className="inline-flex items-center gap-3 bg-blue-50 border-2 border-blue-200 rounded-2xl px-6 py-4">
              <span className="text-3xl">💰</span>
              <div>
                <p className="text-sm text-gray-600">A사 대비에도 <strong className="text-gray-900">7배 이상</strong> 절감</p>
                <p className="text-2xl font-black text-blue-700">최대 815만원 절감 <span className="text-sm font-semibold text-blue-500">(C사 대비)</span></p>
              </div>
            </div>
          </div>

          {/* Comparison table */}
          <div className="max-w-2xl mx-auto bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden">
            <div className="grid grid-cols-3 text-center text-sm font-bold border-b border-gray-200 py-3 bg-gray-100">
              <span className="text-gray-500">항목</span>
              <span className="text-gray-500">구독형</span>
              <span className="text-blue-600">KeystoneHR</span>
            </div>
            {[
              { label: '과금 방식', sub: '인당 × 매월 반복', keystone: '1회 결제, 끝' },
              { label: '직원 추가 시', sub: '인당 추가 과금', keystone: '무료 (무제한)' },
              { label: '3년 후 해지 시', sub: '0원 — 돌려받는 것 없음', keystone: '영구 사용' },
              { label: '숨은 추가 비용', sub: '기능별 +1~3만원/월', keystone: '없음' },
              { label: '전체 기능 이용', sub: '플랜별 제한', keystone: '모두 포함' },
            ].map((row, i) => (
              <div key={row.label} className={`grid grid-cols-3 text-center text-sm py-3.5 px-4 ${i % 2 === 0 ? '' : 'bg-white'}`}>
                <span className="text-gray-700 font-medium text-left">{row.label}</span>
                <span className="text-red-500 font-semibold">{row.sub}</span>
                <span className="text-blue-600 font-bold">✓ {row.keystone}</span>
              </div>
            ))}
          </div>

          <div className="text-center mt-8">
            <a
              href="#pricing"
              className="inline-block px-8 py-3.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition shadow-lg shadow-blue-600/25"
            >
              요금제 자세히 보기
            </a>
          </div>
        </div>
      </section>

      {/* Differentiators */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              다른 HR 솔루션과 다릅니다
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
                  <span className="inline-block px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold mb-4">
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
                  <div className={`grid ${item.screenshots.length >= 3 ? 'grid-cols-3' : item.screenshots.length > 1 ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
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
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              기본도 탄탄합니다
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

      {/* My Leave Screenshot */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-12 items-center">
            <div className="lg:w-5/12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                직원 셀프서비스
              </h2>
              <p className="text-gray-600 mb-6 leading-relaxed">
                직원이 직접 휴가 잔여일을 확인하고, 휴가/연장근무/복지를 신청합니다.
                관리자에게 물어볼 필요 없이, 모든 것이 한 화면에.
              </p>
              <ul className="space-y-3 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  잔여 연차, 사용 현황 실시간 확인
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  휴가/연장근무/복지 온라인 신청
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  신청 진행 상태 추적
                </li>
              </ul>
            </div>
            <div className="lg:w-7/12">
              <div className="rounded-xl overflow-hidden shadow-xl border border-gray-200">
                <ClickableImage
                  src="/screenshots/18_my_leave.png"
                  alt="내 휴가 현황"
                  width={1440}
                  height={900}
                  className="w-full"
                  caption="내 휴가 — 잔여일수, 신청 내역, 사용 현황"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Approval Workflow */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              결재도 온라인으로
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              연장근무, 휴가, 복지 신청을 관리자가 한 화면에서 확인하고 승인합니다
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <div className="group">
              <div className="rounded-xl overflow-hidden shadow-lg border border-gray-200 transition group-hover:shadow-xl">
                <ClickableImage
                  src="/screenshots/14_overtime_approval_list.png"
                  alt="결재 대기 목록"
                  width={1440}
                  height={900}
                  className="w-full"
                  caption="결재 대기 목록 — 승인/반려 버튼으로 즉시 처리"
                />
              </div>
              <p className="text-xs text-gray-400 text-center mt-2">결재 대기 목록</p>
            </div>
            <div className="group">
              <div className="rounded-xl overflow-hidden shadow-lg border border-gray-200 transition group-hover:shadow-xl">
                <ClickableImage
                  src="/screenshots/14_overtime_approved.png"
                  alt="결재 승인 처리"
                  width={1440}
                  height={900}
                  className="w-full"
                  caption="승인 확인 — 클릭 한 번으로 결재 완료"
                />
              </div>
              <p className="text-xs text-gray-400 text-center mt-2">승인 확인 처리</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              심플한 요금제
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              추가 비용 없이, 모든 기능을 하나의 플랜으로
            </p>
          </div>

          <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-6">
            {/* 50명 플랜 */}
            <div className="p-8 rounded-2xl bg-white border-2 border-gray-200 shadow-lg relative overflow-hidden hover:border-blue-400 transition">
              <h3 className="text-2xl font-bold text-gray-900 mb-1">Standard</h3>
              <p className="text-gray-500 text-sm mb-6">50명 이하 중소기업</p>

              <div className="mb-2">
                <span className="text-4xl font-bold text-gray-900">49</span>
                <span className="text-xl font-bold text-gray-900">만원</span>
              </div>
              <p className="text-sm text-gray-400 mb-6">1회 구매 · 영구 사용 · 최대 50명</p>

              <div className="space-y-2.5 mb-8">
                {ALL_FEATURES.map((feature) => (
                  <div key={feature} className="flex items-start gap-2 text-sm text-gray-600">
                    <svg className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </div>
                ))}
              </div>

              <a
                href="/start"
                className="block w-full py-3.5 rounded-xl font-semibold transition text-center bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/25"
              >
                7일 무료 체험 시작하기
              </a>
            </div>

            {/* 100명 플랜 */}
            <div className="p-8 rounded-2xl bg-white border-2 border-blue-600 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs font-bold px-4 py-1.5 rounded-bl-lg">
                BEST
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">Business</h3>
              <p className="text-gray-500 text-sm mb-6">100명 이하 중견기업</p>

              <div className="mb-2">
                <span className="text-4xl font-bold text-gray-900">69</span>
                <span className="text-xl font-bold text-gray-900">만원</span>
              </div>
              <p className="text-sm text-gray-400 mb-6">1회 구매 · 영구 사용 · 최대 100명</p>

              <div className="space-y-2.5 mb-8">
                {ALL_FEATURES.map((feature) => (
                  <div key={feature} className="flex items-start gap-2 text-sm text-gray-600">
                    <svg className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </div>
                ))}
              </div>

              <a
                href="/start"
                className="block w-full py-3.5 rounded-xl font-semibold transition text-center bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/25"
              >
                7일 무료 체험 시작하기
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-blue-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            지금 바로 시작하세요
          </h2>
          <p className="text-blue-100 text-lg mb-8 max-w-2xl mx-auto">
            7일 무료 체험 후, 1회 구매로 영구 사용. 복잡한 설치 없이 바로 시작하세요.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <a
              href="/start"
              className="px-8 py-3.5 bg-white text-blue-600 rounded-xl font-semibold hover:bg-blue-50 transition"
            >
              7일 무료 체험
            </a>
            <a
              href="/login"
              className="px-8 py-3.5 border border-white/30 text-white rounded-xl font-semibold hover:bg-white/10 transition"
            >
              로그인
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
