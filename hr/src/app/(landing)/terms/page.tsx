import Image from 'next/image';

export default function TermsPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center gap-3 mb-8">
        <Image src="/logo.png" alt="KeystoneHR" width={40} height={40} className="w-10 h-10" />
        <h1 className="text-3xl font-bold text-gray-900">이용약관</h1>
      </div>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">제1조 (목적)</h2>
        <p className="text-gray-700 leading-relaxed">
          본 약관은 키스톤에이치알(이하 &quot;회사&quot;)이 제공하는 KeystoneHR 인사관리
          서비스(이하 &quot;서비스&quot;)의 이용 조건 및 절차, 회사와 이용자의 권리·의무 및
          책임 사항을 규정함을 목적으로 합니다.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">제2조 (용어의 정의)</h2>
        <ul className="list-decimal list-inside space-y-2 text-gray-700">
          <li>&quot;서비스&quot;란 회사가 제공하는 클라우드 기반 인사관리 시스템(HR SaaS)을 말합니다.</li>
          <li>&quot;이용자&quot;란 본 약관에 따라 회사와 이용 계약을 체결하고 서비스를 이용하는 기업 또는 개인을 말합니다.</li>
          <li>&quot;계정&quot;이란 이용자가 서비스에 접속하기 위해 설정한 이메일과 비밀번호의 조합을 말합니다.</li>
          <li>&quot;테넌트&quot;란 서비스 내에서 이용자(기업)별로 독립적으로 운영되는 데이터 공간을 말합니다.</li>
          <li>&quot;관리자&quot;란 테넌트 내에서 서비스 설정 및 직원 관리 권한을 가진 이용자를 말합니다.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">제3조 (약관의 효력 및 변경)</h2>
        <ul className="list-decimal list-inside space-y-2 text-gray-700">
          <li>본 약관은 서비스 화면에 게시하거나 기타의 방법으로 이용자에게 공지함으로써 효력이 발생합니다.</li>
          <li>회사는 합리적인 사유가 발생할 경우 관련 법령에 위배되지 않는 범위 내에서 본 약관을 변경할 수 있으며, 변경된 약관은 적용일자 7일 전부터 서비스 내 공지합니다.</li>
          <li>이용자가 변경된 약관에 동의하지 않는 경우 서비스 이용을 중단하고 이용 계약을 해지할 수 있습니다.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">제4조 (서비스의 제공)</h2>
        <p className="text-gray-700 leading-relaxed">회사는 다음과 같은 서비스를 제공합니다.</p>
        <ul className="list-disc list-inside mt-3 space-y-1 text-gray-700">
          <li>직원 정보 관리 (인사 기본 정보, 조직 구조)</li>
          <li>근태 관리 (출퇴근 기록, 근무 시간 관리)</li>
          <li>연차 및 휴가 관리</li>
          <li>급여 관리</li>
          <li>조직도 및 부서 관리</li>
          <li>기타 회사가 추가 개발하여 제공하는 인사관리 관련 기능</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">제5조 (회원가입 및 계정)</h2>
        <ul className="list-decimal list-inside space-y-2 text-gray-700">
          <li>이용자는 회사가 정한 절차에 따라 회원가입을 신청하며, 회사는 이를 승낙함으로써 이용 계약이 성립됩니다.</li>
          <li>이용자는 정확하고 최신의 정보를 제공해야 하며, 정보 변경 시 지체 없이 수정해야 합니다.</li>
          <li>이용자는 자신의 계정 정보를 안전하게 관리할 책임이 있으며, 제3자에게 계정을 양도하거나 대여할 수 없습니다.</li>
          <li>계정의 부정 사용이 발견된 경우 이용자는 즉시 회사에 통보해야 합니다.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">제6조 (이용자의 의무)</h2>
        <p className="text-gray-700 leading-relaxed">이용자는 다음 행위를 하여서는 안 됩니다.</p>
        <ul className="list-disc list-inside mt-3 space-y-1 text-gray-700">
          <li>허위 정보를 등록하는 행위</li>
          <li>타인의 개인정보를 무단으로 수집, 저장, 공개하는 행위</li>
          <li>서비스의 운영을 방해하거나 안정성을 해치는 행위</li>
          <li>회사의 지적재산권을 침해하는 행위</li>
          <li>서비스를 이용하여 법령 또는 공서양속에 반하는 행위</li>
          <li>서비스의 취약점을 악용하거나 무단으로 시스템에 접근하는 행위</li>
          <li>기타 관련 법령에 위반되는 행위</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">제7조 (서비스 이용 제한)</h2>
        <ul className="list-decimal list-inside space-y-2 text-gray-700">
          <li>회사는 이용자가 본 약관의 의무를 위반하거나 서비스의 정상적인 운영을 방해한 경우 서비스 이용을 제한하거나 이용 계약을 해지할 수 있습니다.</li>
          <li>회사는 이용 제한 조치 시 그 사유, 제한 기간 등을 이용자에게 통지합니다.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">제8조 (회사의 의무)</h2>
        <ul className="list-decimal list-inside space-y-2 text-gray-700">
          <li>회사는 관련 법령과 본 약관이 금지하거나 미풍양속에 반하는 행위를 하지 않으며, 지속적이고 안정적으로 서비스를 제공하기 위하여 최선을 다합니다.</li>
          <li>회사는 이용자의 개인정보를 안전하게 보호하며, 개인정보처리방침에 따라 처리합니다.</li>
          <li>회사는 서비스 이용과 관련한 이용자의 문의 및 불만 사항을 신속하게 처리하기 위하여 노력합니다.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">제9조 (개인정보 보호)</h2>
        <p className="text-gray-700 leading-relaxed">
          회사는 이용자의 개인정보를 보호하기 위해 개인정보보호법 등 관련 법령이 정하는
          바를 준수하며, 자세한 사항은{' '}
          <a href="/privacy" className="text-blue-600 hover:text-blue-800 underline">
            개인정보처리방침
          </a>
          에 따릅니다.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">제10조 (서비스의 변경 및 중단)</h2>
        <ul className="list-decimal list-inside space-y-2 text-gray-700">
          <li>회사는 상당한 이유가 있는 경우 서비스의 전부 또는 일부를 변경하거나 중단할 수 있습니다.</li>
          <li>서비스의 중단이 필요한 경우 회사는 30일 전에 이를 공지합니다. 다만, 천재지변이나 이에 준하는 불가항력으로 인한 경우에는 사전 공지 없이 서비스를 중단할 수 있습니다.</li>
          <li>회사는 무료로 제공하는 서비스의 일부 또는 전부를 회사의 정책 및 운영의 필요에 따라 수정, 중단, 변경할 수 있으며, 이에 대하여 관련 법령에 특별한 규정이 없는 한 별도의 보상을 하지 않습니다.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">제11조 (책임 제한)</h2>
        <ul className="list-decimal list-inside space-y-2 text-gray-700">
          <li>회사는 천재지변 또는 이에 준하는 불가항력으로 인하여 서비스를 제공할 수 없는 경우에는 서비스 제공에 관한 책임이 면제됩니다.</li>
          <li>회사는 이용자의 귀책사유로 인한 서비스 이용의 장애에 대하여 책임을 지지 않습니다.</li>
          <li>회사는 이용자가 서비스를 이용하여 기대하는 수익을 얻지 못하거나 상실한 것에 대하여 책임을 지지 않습니다.</li>
          <li>회사는 이용자가 서비스에 게재한 정보·자료·사실의 신뢰도 및 정확성 등에 대해서는 책임을 지지 않습니다.</li>
          <li>서비스는 &quot;있는 그대로(AS-IS)&quot; 제공되며, 회사는 서비스의 완전성, 정확성, 특정 목적에의 적합성에 대해 명시적 또는 묵시적 보증을 하지 않습니다.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">제12조 (계약 해지 및 환불)</h2>
        <ul className="list-decimal list-inside space-y-2 text-gray-700">
          <li>이용자는 언제든지 서비스 내 설정 또는 고객 지원을 통해 이용 계약의 해지를 신청할 수 있으며, 회사는 관련 법령에 따라 즉시 처리합니다.</li>
          <li>본 서비스는 1회 구매 모델로 제공되며, 구매 후 환불 정책은 다음과 같습니다:
            <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
              <li>구매 후 7일 이내 서비스를 이용하지 않은 경우: 전액 환불</li>
              <li>구매 후 7일 이내 서비스를 이용한 경우: 환불 불가</li>
              <li>구매 후 7일 경과: 환불 불가</li>
            </ul>
          </li>
          <li>계약 해지 시 이용자의 데이터는 관련 법령에 따라 일정 기간 보관 후 파기됩니다.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">제13조 (분쟁 해결)</h2>
        <ul className="list-decimal list-inside space-y-2 text-gray-700">
          <li>본 약관과 서비스 이용에 관한 분쟁은 대한민국 법률을 준거법으로 합니다.</li>
          <li>서비스 이용과 관련하여 회사와 이용자 간에 발생한 분쟁에 대하여는 민사소송법상의 관할 법원에 소를 제기합니다.</li>
          <li>회사와 이용자 간에 발생한 분쟁은 전자상거래 분쟁조정위원회, 한국소비자원 등의 조정을 통하여 해결할 수 있습니다.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">제14조 (시행일)</h2>
        <p className="text-gray-700 leading-relaxed">
          본 약관은 2026년 3월 11일부터 시행합니다.
        </p>
      </section>
    </main>
  );
}
