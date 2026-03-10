'use client';

const FEATURES = [
  {
    title: '출퇴근 관리',
    description: '실시간 출퇴근 기록, 근태 현황 대시보드, 부서별 통계',
  },
  {
    title: '휴가 관리',
    description: '연차/반차/병가 등 다양한 휴가 유형, 자동 잔여일수 계산',
  },
  {
    title: '결재 시스템',
    description: '다단계 결재 라인, 휴가/연장근무 결재 자동화',
  },
  {
    title: '연장근무 관리',
    description: '연장/야간/휴일 근무 신청 및 승인, 보상시간 자동 계산',
  },
  {
    title: '데이터 내보내기',
    description: 'Excel/CSV 형식으로 직원, 근태, 휴가 데이터 일괄 내보내기',
  },
  {
    title: '복지 관리',
    description: '회사별 맞춤 복지 혜택 등록 및 신청 관리',
  },
];

const ALL_FEATURES = [
  '출퇴근 관리',
  '휴가 관리',
  '결재 시스템',
  '연장근무 관리',
  '데이터 내보내기',
  '복지 관리',
  '직원 관리',
  '대시보드',
  '알림 시스템',
];

export default function LandingPage() {
  return (
    <main>
      {/* Hero */}
      <section className="py-20 bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
            스마트한 인사관리,
            <br />
            <span className="text-blue-600">KeystoneHR</span>로 시작하세요
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
            출퇴근, 휴가, 결재, 연장근무까지. 하나의 플랫폼으로 모든 HR 업무를
            관리하세요. 설치 없이 바로 시작할 수 있습니다.
          </p>
          <div className="flex justify-center gap-4">
            <a
              href="/register"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
            >
              시작하기
            </a>
            <a
              href="/login"
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition"
            >
              로그인
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-4">
            주요 기능
          </h2>
          <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
            모든 기능을 하나의 플랜으로 제공합니다
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="p-6 rounded-xl border border-gray-200 hover:border-blue-200 hover:shadow-md transition"
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing - Single Standard Plan */}
      <section id="pricing" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-4">
            요금제
          </h2>
          <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
            모든 기능이 포함된 단일 플랜을 제공합니다
          </p>
          <div className="max-w-md mx-auto">
            <div className="p-8 rounded-xl bg-white border-2 border-blue-600 shadow-lg">
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Standard
              </h3>
              <p className="text-gray-500 text-sm mb-4">모든 HR 관리 기능을 포함한 올인원 솔루션</p>
              <div className="mb-6">
                <span className="text-3xl font-bold text-gray-900">
                  ₩49,000
                </span>
                <span className="text-gray-500">/월</span>
              </div>
              <ul className="space-y-3 mb-8">
                {ALL_FEATURES.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-gray-600">
                    <svg
                      className="w-5 h-5 text-blue-600 shrink-0 mt-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
              <a
                href="/register"
                className="block w-full py-2.5 rounded-lg font-medium transition text-center bg-blue-600 text-white hover:bg-blue-700"
              >
                시작하기
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
