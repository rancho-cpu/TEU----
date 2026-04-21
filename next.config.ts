import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 클라이언트 라우터 캐시 연장 — 이미 방문한 페이지로 돌아갈 때 스켈레톤 없이 즉시 표시
  experimental: {
    staleTimes: {
      dynamic: 120, // 2분: 사이드바 메뉴 왕복 네비게이션 대부분이 캐시 히트
      static: 300,  // 5분
    },
  },
};

export default nextConfig;
