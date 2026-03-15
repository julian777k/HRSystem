"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RotateCcw } from "lucide-react";

export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[MainLayout Error]", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md px-6">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          페이지 로드 중 오류가 발생했습니다
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          일시적인 문제일 수 있습니다. 다시 시도해 주세요.
        </p>
        <div className="flex gap-3 justify-center">
          <Button onClick={reset} variant="default" size="sm">
            <RotateCcw className="w-4 h-4 mr-1" />
            다시 시도
          </Button>
          <Button
            onClick={() => window.location.href = "/dashboard"}
            variant="outline"
            size="sm"
          >
            대시보드로 이동
          </Button>
        </div>
      </div>
    </div>
  );
}
