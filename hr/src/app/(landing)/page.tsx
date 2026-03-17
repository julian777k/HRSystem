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
      <section className="pt-16 sm:pt-24 pb-12 bg-gradient-to-b from-blue-50 via-white to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <p className="text-blue-600 font-semibold text-sm mb-3 tracking-wide">
              중소기업을 위한 올인원 HR 솔루션
            </p>
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-gray-900 mb-6 leading-tight">
              HR 솔루션이{' '}
              <span className="text-blue-600">월 4,083원?</span>
              <br />
              <span className="text-gray-400 text-lg sm:text-3xl lg:text-4xl font-bold">네, 커피 한 잔 값으로 10년 쓰는 인사관리</span>
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto mb-8">
              출퇴근, 휴가, 결재, 연장근무, 복지까지.
              <br className="hidden sm:block" />
              구독료 없이 1회 결제(49만원), 10년 사용.
            </p>
          </div>
        </div>
      </section>

      {/* Price Comparison — 최상단 후킹 */}
      <section className="py-16 sm:py-20 bg-gradient-to-b from-slate-900 to-slate-800 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Hooking message */}
          <div className="text-center mb-4">
            <p className="text-blue-400 font-bold text-sm sm:text-base mb-4 tracking-wide">
              직원 20명 기준 · 3년 비용 비교 · VAT 별도
            </p>
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black mb-4 leading-tight">
              3년에 <span className="text-red-400">864만원</span> 쓸 건가요?<br />
              <span className="text-blue-400">49만원</span>이면 <span className="text-blue-400">10년</span> 씁니다.
            </h2>
            <p className="text-slate-400 text-base sm:text-lg max-w-xl mx-auto">
              구독형 HR 솔루션은 매달 인당 요금이 쌓입니다.<br className="hidden sm:block" />
              KeystoneHR은 1회 결제, 10년 사용. 추가 비용 없습니다.
            </p>
          </div>

          {/* Bar Chart */}
          <div className="flex items-end justify-center gap-4 sm:gap-6 mt-4 sm:mt-6 mb-4 h-[180px] sm:h-[300px]">
            {[
              { name: 'A사', total: 360, perPerson: '5,000', monthly: 10, height: '42%', barColor: 'bg-slate-500' },
              { name: 'B사', total: 576, perPerson: '8,000', monthly: 16, height: '67%', barColor: 'bg-red-500/80' },
              { name: 'C사', total: 864, perPerson: '12,000', monthly: 24, height: '100%', barColor: 'bg-red-600' },
            ].map((item) => (
              <div key={item.name} className="flex flex-col items-center w-16 sm:w-auto sm:flex-1 sm:max-w-[160px]">
                <p className="text-sm sm:text-2xl font-black text-white mb-1">{item.total}<span className="text-[9px] sm:text-sm font-bold text-slate-400">만</span></p>
                <div className={`w-full rounded-t-xl ${item.barColor} relative overflow-hidden`} style={{ height: item.height }}>
                  <span className="absolute inset-0 hidden lg:flex items-center justify-center text-white/80 text-xs font-medium leading-tight text-center px-0.5">
                    월 {item.monthly}만<br />× 36월
                  </span>
                </div>
                <div className="mt-1.5 sm:mt-3 text-center">
                  <p className="font-bold text-slate-300 text-[11px] sm:text-base">{item.name}</p>
                  <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 hidden md:block">인당 월 {item.perPerson}원</p>
                  <p className="text-[9px] sm:text-[10px] text-slate-600 mt-0.5 hidden md:block">{item.perPerson}원 × 20명 = 월 {item.monthly}만원</p>
                </div>
              </div>
            ))}
            <div className="flex flex-col items-center w-16 sm:w-auto sm:flex-1 sm:max-w-[160px]">
              <p className="text-sm sm:text-2xl font-black text-blue-400 mb-1">49<span className="text-[9px] sm:text-sm font-bold">만</span></p>
              <div className="w-full rounded-t-xl bg-blue-500 shadow-lg shadow-blue-500/40 relative" style={{ height: '5.7%' }} />
              <div className="mt-1.5 sm:mt-3 text-center">
                <p className="font-bold text-blue-400 text-[11px] sm:text-base">KeystoneHR</p>
                <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">1회 결제 · 10년</p>
                <p className="text-[9px] sm:text-[10px] text-slate-600 mt-0.5 hidden sm:block">50명 이하 기준</p>
              </div>
            </div>
          </div>

          {/* Calculation note */}
          <p className="text-center text-xs text-slate-500 mb-8">
            * 구독형 = 인당 월 요금 × 20명 × 36개월. 시장 평균 기준이며, 실제 서비스별로 다를 수 있습니다.
          </p>

          {/* Hooking callout */}
          <div className="flex justify-center mb-10">
            <div className="inline-flex flex-col sm:flex-row items-center gap-2 sm:gap-3 bg-blue-500/10 border border-blue-400/30 rounded-2xl px-5 sm:px-8 py-4 sm:py-5 backdrop-blur max-w-full">
              <span className="text-3xl sm:text-4xl">🔥</span>
              <div className="text-center sm:text-left">
                <p className="text-blue-300 text-xs sm:text-sm font-semibold">구독형 최저가 A사와 비교해도</p>
                <p className="text-xl sm:text-3xl font-black text-white">7배 저렴합니다</p>
                <p className="text-blue-400 text-sm sm:text-lg font-bold">→ 311만원 절감</p>
              </div>
            </div>
          </div>

          {/* Comparison table */}
          <div className="max-w-2xl mx-auto bg-slate-800/50 rounded-2xl border border-slate-700 overflow-hidden">
            <div className="grid grid-cols-3 text-center text-xs sm:text-sm font-bold border-b border-slate-700 py-3 px-2 sm:px-4">
              <span className="text-slate-400">항목</span>
              <span className="text-slate-400">구독형</span>
              <span className="text-blue-400">KeystoneHR</span>
            </div>
            {[
              { label: '과금 방식', sub: '인당 × 매월 반복', keystone: '1회 결제, 끝' },
              { label: '직원 추가 시', sub: '인당 추가 과금', keystone: '플랜 내 무료' },
              { label: '사용 기간', sub: '해지하면 끝', keystone: '10년 사용' },
              { label: '숨은 비용', sub: '기능별 +1~3만원/월', keystone: '없음' },
              { label: '전체 기능', sub: '플랜별 제한', keystone: '모두 포함' },
            ].map((row, i) => (
              <div key={row.label} className={`grid grid-cols-3 text-center text-xs sm:text-sm py-3 sm:py-3.5 px-2 sm:px-4 ${i % 2 === 0 ? 'bg-slate-800/30' : ''}`}>
                <span className="text-slate-300 font-medium text-left">{row.label}</span>
                <span className="text-red-400 font-semibold">{row.sub}</span>
                <span className="text-blue-400 font-bold">✓ {row.keystone}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-3 mt-10">
            <a
              href="/start"
              className="px-8 py-3.5 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 transition shadow-lg shadow-blue-500/30 text-center"
            >
              7일 무료 체험 시작하기
            </a>
            <a
              href="#pricing"
              className="px-8 py-3.5 border border-slate-600 text-slate-300 rounded-xl font-semibold hover:bg-slate-700 transition text-center"
            >
              요금제 자세히 보기
            </a>
          </div>
        </div>
      </section>

      {/* Feature Comparison — 브릿지 */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-blue-600 font-bold text-sm mb-3 tracking-wide">잠깐, 가격만 싼 게 아닙니다</p>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-4">
              타사 <span className="text-red-500">유료 추가 기능</span>,<br />
              KeystoneHR은 <span className="text-blue-600">전부 무료</span>입니다
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              구독형 서비스에서 기능당 월 1~3만원씩 추가 결제해야 하는 기능들, 전부 기본 포함
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
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 pl-1">{section.category}</p>
                <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                  <table className="w-full border-collapse text-xs sm:text-sm min-w-[380px] sm:min-w-[480px]">
                    <thead>
                      <tr className="border-b-2 border-gray-200">
                        <th className="text-left text-gray-800 font-bold py-2 sm:py-3 pl-3 sm:pl-5 pr-1 sm:pr-2" style={{ width: '36%' }}>기능</th>
                        <th className="text-center text-gray-400 font-bold py-2 sm:py-3 px-0.5 sm:px-1" style={{ width: '16%' }}>A사</th>
                        <th className="text-center text-gray-400 font-bold py-2 sm:py-3 px-0.5 sm:px-1" style={{ width: '16%' }}>B사</th>
                        <th className="text-center text-gray-400 font-bold py-2 sm:py-3 px-0.5 sm:px-1" style={{ width: '16%' }}>C사</th>
                        <th className="text-center text-blue-600 font-bold py-2 sm:py-3 px-0.5 sm:px-1 relative" style={{ width: '16%' }}>
                          <span className="hidden sm:inline">KeystoneHR</span>
                          <span className="sm:hidden">KHR</span>
                          <span className="absolute top-0 left-0.5 sm:left-1 right-0.5 sm:right-1 h-[3px] bg-blue-600 rounded-b" />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.rows.map((row, i) => {
                        const icon = (v: string) => {
                          if (v === 'yes') return <span className="inline-flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-blue-50 text-blue-600 text-xs sm:text-sm">✓</span>;
                          if (v === 'partial') return <span className="inline-flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-amber-50 text-amber-500 text-xs sm:text-sm">△</span>;
                          if (v === 'extra') return <span className="inline-flex items-center justify-center px-1 sm:px-2 py-0.5 sm:py-1 rounded-md bg-red-50 text-red-600 text-[9px] sm:text-[11px] font-bold">+별도</span>;
                          return <span className="inline-flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-gray-100 text-gray-400 text-xs sm:text-sm font-bold">✕</span>;
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

          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-10">
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 sm:p-6 text-center">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 sm:mb-3">일반 구독형 (평균)</p>
              <p className="text-3xl sm:text-4xl font-black text-gray-600">7<span className="text-sm sm:text-base font-bold text-gray-400"> / 13개</span></p>
              <p className="text-xs text-gray-400 mt-2">기능 기본 포함 · 나머지는 별도 결제 또는 미지원</p>
            </div>
            <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-5 sm:p-6 text-center">
              <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-2 sm:mb-3">KeystoneHR</p>
              <p className="text-3xl sm:text-4xl font-black text-blue-700">13<span className="text-sm sm:text-base font-bold text-blue-400"> / 13개</span></p>
              <p className="text-xs text-blue-500 mt-2">전체 기능 기본 포함 · 추가 과금 항목 0개</p>
            </div>
          </div>

          {/* Callout */}
          <div className="mt-8 flex gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <span className="text-xl shrink-0">⚠️</span>
            <p className="text-sm text-amber-800">
              구독형 서비스의 <strong>&quot;+별도&quot;는 기능당 월 1~3만원</strong>이 추가됩니다.
              필요한 기능을 모두 켜면 실제 비용은 기본료의 <strong>2~3배</strong>까지 올라갈 수 있습니다.
            </p>
          </div>
        </div>
      </section>

      {/* Dashboard Screenshot */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
              <p className="text-sm text-gray-400 mb-6">1회 구매 · 10년 사용 · 최대 50명</p>

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
              <p className="text-gray-500 text-sm mb-6"><span className="text-red-500 font-bold">100명</span> 이하 중견기업</p>

              <div className="mb-2">
                <span className="text-4xl font-bold text-gray-900">70</span>
                <span className="text-xl font-bold text-gray-900">만원</span>
              </div>
              <p className="text-sm text-gray-400 mb-6">1회 구매 · 10년 사용 · 최대 <span className="text-red-500 font-semibold">100명</span></p>

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
