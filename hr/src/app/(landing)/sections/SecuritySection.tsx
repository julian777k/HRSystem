// S8. 보안·데이터 신뢰 — HR 개인정보 우려 해소 (B2B 전환의 마지막 관문)
const ITEMS = [
    {
        title: '저장·전송 전 구간 암호화',
        desc: '데이터는 저장될 때도, 오갈 때도 암호화됩니다. HTTPS 전 구간 적용.',
    },
    {
        title: '모든 변경 이력 감사로그',
        desc: '결재·휴가 부여·권한 변경·직원 정보 수정이 언제 누구에 의해 이뤄졌는지 기록됩니다.',
    },
    {
        title: '회사마다 격리된 독립 공간',
        desc: '테넌트별 전용 서브도메인으로 분리 운영. 다른 회사 데이터와 섞이지 않습니다.',
    },
    {
        title: 'Cloudflare 글로벌 인프라',
        desc: '전 세계 엣지 네트워크에서 운영되어 빠르고 안정적으로 접속됩니다.',
    },
];

export default function SecuritySection() {
    return (
        <section className="py-14 sm:py-24 bg-white">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-12">
                    <p className="text-brand-accent font-semibold text-sm mb-3 tracking-wide">보안 · 데이터 관리</p>
                    <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4 tracking-tight" style={{ textWrap: 'balance' }}>
                        직원 데이터, 안전하게 다룹니다
                    </h2>
                    <p className="text-gray-600 max-w-2xl mx-auto leading-relaxed">
                        인사 데이터는 민감한 개인정보입니다. 맡기셔도 되도록, 기본을 지켰습니다.
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 max-w-4xl mx-auto">
                    {ITEMS.map((item) => (
                        <div key={item.title} className="flex gap-4 p-6 rounded-2xl border border-gray-200 bg-gray-50">
                            <div className="shrink-0 w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center">
                                <svg className="w-6 h-6 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1">{item.title}</h3>
                                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
