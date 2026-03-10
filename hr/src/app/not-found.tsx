import Link from 'next/link';
import Image from 'next/image';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Image src="/logo.png" alt="KeystoneHR" width={64} height={64} className="mx-auto mb-4" />
        <h1 className="text-6xl font-bold text-gray-300 mb-2">404</h1>
        <p className="text-gray-500 mb-6">페이지를 찾을 수 없습니다</p>
        <Link href="/dashboard" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm">
          대시보드로 이동
        </Link>
      </div>
    </div>
  );
}
