'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

interface ChallengeStatItem {
  title: string
  submission_count: number
  total_members: number
  percentage: number
}

interface SurveyStatItem {
  title: string
  response_count: number
}

interface JoinTrendItem {
  month: string
  count: number
}

interface StatsClientWrapperProps {
  challengeStats: ChallengeStatItem[]
  surveyStats: SurveyStatItem[]
  joinTrend: JoinTrendItem[]
  totalMembers: number
}

const BLUE_SHADES = ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe']

export function StatsClientWrapper({
  challengeStats,
  surveyStats,
  joinTrend,
  totalMembers,
}: StatsClientWrapperProps) {
  return (
    <div className="space-y-8">
      {/* Challenge Completion */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-5 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
          챌린지 완료율
        </h2>

        {challengeStats.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">챌린지 데이터가 없습니다.</p>
        ) : (
          <div className="space-y-4">
            {challengeStats.map((stat, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-gray-700 truncate max-w-xs">
                    {stat.title}
                  </span>
                  <span className="text-sm text-gray-500 ml-4 flex-shrink-0">
                    {stat.submission_count} / {stat.total_members}명
                    <span className="ml-2 text-blue-600 font-medium">
                      ({stat.percentage}%)
                    </span>
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${stat.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Survey Responses Bar Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-5 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
          설문 응답 현황
        </h2>

        {surveyStats.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">설문 데이터가 없습니다.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={surveyStats}
              margin={{ top: 4, right: 8, left: -16, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="title"
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  fontSize: '13px',
                }}
                formatter={(value) => [`${value}명`, '응답 수']}
              />
              <Bar dataKey="response_count" radius={[4, 4, 0, 0]}>
                {surveyStats.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={BLUE_SHADES[index % BLUE_SHADES.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Member Join Trend */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
            멤버 가입 추이
          </h2>
          <span className="text-sm text-gray-500">
            총 <span className="font-semibold text-gray-900">{totalMembers}</span>명
          </span>
        </div>

        {joinTrend.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">가입 데이터가 없습니다.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={joinTrend}
              margin={{ top: 4, right: 8, left: -16, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  fontSize: '13px',
                }}
                formatter={(value) => [`${value}명`, '신규 가입']}
              />
              <Bar dataKey="count" fill="#a78bfa" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
