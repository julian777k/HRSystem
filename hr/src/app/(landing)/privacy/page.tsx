import Image from 'next/image';

export default function PrivacyPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center gap-3 mb-8">
        <Image src="/logo.png" alt="KeystoneHR" width={40} height={40} className="w-10 h-10" />
        <h1 className="text-3xl font-bold text-gray-900">개인정보처리방침</h1>
      </div>

      <p className="text-sm text-gray-500 mb-8">
        키스톤에이치알(이하 &quot;회사&quot;)은 개인정보보호법에 따라 이용자의 개인정보를
        보호하고 이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록 다음과 같이
        개인정보 처리방침을 수립·공개합니다.
      </p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">1. 개인정보의 처리 목적</h2>
        <p className="text-gray-700 leading-relaxed">
          회사는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는
          다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는
          개인정보보호법 제18조에 따라 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.
        </p>
        <ul className="list-disc list-inside mt-3 space-y-1 text-gray-700">
          <li>회원 가입 및 관리: 회원제 서비스 이용에 따른 본인 확인, 회원자격 유지·관리</li>
          <li>인사관리 서비스 제공: 직원 정보 관리, 근태 관리, 급여 관리, 연차/휴가 관리 등 인사관리 기능 제공</li>
          <li>서비스 개선: 서비스 이용 기록 분석을 통한 서비스 개선 및 신규 서비스 개발</li>
          <li>고충 처리: 이용자의 문의 및 불만 처리, 공지사항 전달</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">2. 수집하는 개인정보 항목</h2>
        <p className="text-gray-700 leading-relaxed">회사는 서비스 제공을 위해 다음의 개인정보를 수집합니다.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full border border-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="border border-gray-200 px-4 py-2 text-left font-medium text-gray-700">구분</th>
                <th className="border border-gray-200 px-4 py-2 text-left font-medium text-gray-700">수집 항목</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-200 px-4 py-2 text-gray-700">필수</td>
                <td className="border border-gray-200 px-4 py-2 text-gray-700">
                  이름, 이메일 주소, 비밀번호, 사번, 부서, 직급, 입사일
                </td>
              </tr>
              <tr>
                <td className="border border-gray-200 px-4 py-2 text-gray-700">선택</td>
                <td className="border border-gray-200 px-4 py-2 text-gray-700">
                  전화번호, 주소, 프로필 사진
                </td>
              </tr>
              <tr>
                <td className="border border-gray-200 px-4 py-2 text-gray-700">자동 수집</td>
                <td className="border border-gray-200 px-4 py-2 text-gray-700">
                  IP 주소, 쿠키, 접속 로그, 서비스 이용 기록, 브라우저 정보
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">3. 개인정보의 보유 및 이용 기간</h2>
        <p className="text-gray-700 leading-relaxed">
          회사는 법령에 따른 개인정보 보유·이용 기간 또는 정보주체로부터 개인정보를
          수집 시에 동의받은 개인정보 보유·이용 기간 내에서 개인정보를 처리·보유합니다.
        </p>
        <ul className="list-disc list-inside mt-3 space-y-1 text-gray-700">
          <li>회원 정보: 회원 탈퇴 시까지 (탈퇴 후 지체 없이 파기)</li>
          <li>인사 관련 정보: 서비스 이용 계약 종료 시까지</li>
          <li>관련 법령에 따른 보존: 계약 또는 청약철회 등에 관한 기록 5년, 소비자의 불만 또는 분쟁 처리에 관한 기록 3년, 로그인 기록 3개월</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">4. 개인정보의 제3자 제공</h2>
        <p className="text-gray-700 leading-relaxed">
          회사는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만, 다음의
          경우에는 예외로 합니다.
        </p>
        <ul className="list-disc list-inside mt-3 space-y-1 text-gray-700">
          <li>이용자가 사전에 동의한 경우</li>
          <li>법령의 규정에 의거하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">5. 개인정보처리 위탁</h2>
        <p className="text-gray-700 leading-relaxed">
          회사는 원활한 서비스 제공을 위하여 다음과 같이 개인정보 처리업무를 위탁하고 있습니다.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full border border-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="border border-gray-200 px-4 py-2 text-left font-medium text-gray-700">수탁자</th>
                <th className="border border-gray-200 px-4 py-2 text-left font-medium text-gray-700">위탁 업무</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-200 px-4 py-2 text-gray-700">Cloudflare, Inc.</td>
                <td className="border border-gray-200 px-4 py-2 text-gray-700">
                  클라우드 인프라 운영 및 데이터 호스팅
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">6. 정보주체의 권리·의무 및 행사 방법</h2>
        <p className="text-gray-700 leading-relaxed">
          이용자는 개인정보주체로서 다음과 같은 권리를 행사할 수 있습니다.
        </p>
        <ul className="list-disc list-inside mt-3 space-y-1 text-gray-700">
          <li>개인정보 열람 요구</li>
          <li>오류 등이 있을 경우 정정 요구</li>
          <li>삭제 요구</li>
          <li>처리 정지 요구</li>
        </ul>
        <p className="text-gray-700 leading-relaxed mt-3">
          위 권리 행사는 회사에 대해 서면, 전자우편 등을 통하여 하실 수 있으며, 회사는
          이에 대해 지체 없이 조치하겠습니다. 정보주체가 개인정보의 오류 등에 대한
          정정 또는 삭제를 요구한 경우에는 정정 또는 삭제를 완료할 때까지 당해
          개인정보를 이용하거나 제공하지 않습니다.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">7. 개인정보의 파기</h2>
        <p className="text-gray-700 leading-relaxed">
          회사는 개인정보 보유 기간의 경과, 처리 목적 달성 등 개인정보가 불필요하게 되었을
          때에는 지체 없이 해당 개인정보를 파기합니다.
        </p>
        <ul className="list-disc list-inside mt-3 space-y-1 text-gray-700">
          <li>전자적 파일 형태: 복구 및 재생이 불가능한 방법으로 영구 삭제</li>
          <li>종이 문서: 분쇄기로 분쇄하거나 소각하여 파기</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">8. 자동 수집 장치의 설치·운영 및 거부</h2>
        <p className="text-gray-700 leading-relaxed">
          회사는 이용자에게 개별적인 맞춤 서비스를 제공하기 위해 이용 정보를 저장하고
          수시로 불러오는 &apos;쿠키(cookie)&apos;를 사용합니다.
        </p>
        <ul className="list-disc list-inside mt-3 space-y-1 text-gray-700">
          <li>쿠키의 사용 목적: 이용자의 로그인 상태 유지, 서비스 이용 환경 설정</li>
          <li>쿠키 설치·운영 및 거부: 브라우저 설정을 통해 쿠키 저장을 거부할 수 있으나, 쿠키를 거부할 경우 서비스 이용에 제한이 있을 수 있습니다</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">9. 개인정보 보호 책임자</h2>
        <p className="text-gray-700 leading-relaxed">
          회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한
          정보주체의 불만 처리 및 피해구제 등을 위하여 아래와 같이 개인정보 보호 책임자를
          지정하고 있습니다.
        </p>
        <div className="mt-3 bg-gray-50 p-4 rounded-lg text-sm text-gray-700">
          <p><strong>개인정보 보호 책임자</strong></p>
          <p>회사명: 키스톤에이치알 (KeystoneHR)</p>
          <p>이메일: privacy@keystonehr.app</p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">10. 안전성 확보 조치</h2>
        <p className="text-gray-700 leading-relaxed">
          회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.
        </p>
        <ul className="list-disc list-inside mt-3 space-y-1 text-gray-700">
          <li>관리적 조치: 내부 관리계획 수립·시행, 정기적 직원 교육</li>
          <li>기술적 조치: 개인정보처리시스템 등의 접근 권한 관리, 접근 통제 시스템 설치, 고유식별정보 등의 암호화, 보안 프로그램 설치</li>
          <li>물리적 조치: 전산실, 자료보관실 등의 접근 통제</li>
          <li>비밀번호 암호화: 이용자의 비밀번호는 단방향 암호화(PBKDF2)하여 저장·관리</li>
          <li>전송 구간 암호화: HTTPS(TLS)를 통한 데이터 전송 암호화</li>
          <li>접근 로그 관리: 개인정보처리시스템에 대한 접속 기록을 보관·관리</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">11. 개인정보 처리방침 변경</h2>
        <p className="text-gray-700 leading-relaxed">
          이 개인정보처리방침은 시행일로부터 적용되며, 법령 및 방침에 따른 변경 내용의
          추가, 삭제 및 정정이 있는 경우에는 변경사항의 시행 7일 전부터 공지사항을 통하여
          고지할 것입니다.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">12. 시행일</h2>
        <p className="text-gray-700 leading-relaxed">
          본 개인정보처리방침은 2026년 3월 11일부터 시행합니다.
        </p>
      </section>
    </main>
  );
}
