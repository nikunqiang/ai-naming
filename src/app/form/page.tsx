'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type NamingMode = '传统' | '文学' | '现代' | '混合'
type NameLength = 1 | 2 | '不限'
type Gender = '男' | '女' | '未定'

export default function FormPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    surname: '',
    motherSurname: '',
    gender: '' as Gender | '',
    birthTime: '',
    expectations: '',
    avoidChars: '',
    namingMode: '文学' as NamingMode,
    nameLength: 2 as NameLength,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // 保存表单数据到 sessionStorage
    sessionStorage.setItem('namingFormData', JSON.stringify(formData))
    router.push('/chat')
  }

  const expectationTags = ['聪明', '健康', '善良', '文雅', '大气', '坚强', '快乐']

  return (
    <main className="min-h-screen ink-wash">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-50 bg-ink-50/80 backdrop-blur-sm border-b border-ink-100">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-ink-400 hover:text-ink-600 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </Link>
          <h1 className="font-serif-cn text-lg text-ink-700">取名信息</h1>
          <div className="w-5" />
        </div>
      </header>

      {/* 表单内容 */}
      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        {/* 姓氏 */}
        <section className="space-y-4">
          <div>
            <label className="block text-sm text-ink-600 mb-2">
              父亲姓氏 <span className="text-vermilion-500">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={2}
              value={formData.surname}
              onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
              className="input-field"
              placeholder="请输入姓氏"
            />
          </div>

          <div>
            <label className="block text-sm text-ink-600 mb-2">
              母亲姓氏 <span className="text-ink-300 text-xs ml-1">(可选)</span>
            </label>
            <input
              type="text"
              maxLength={2}
              value={formData.motherSurname}
              onChange={(e) => setFormData({ ...formData, motherSurname: e.target.value })}
              className="input-field"
              placeholder="可用于组合取名"
            />
          </div>
        </section>

        {/* 性别 */}
        <section>
          <label className="block text-sm text-ink-600 mb-3">
            宝宝性别 <span className="text-vermilion-500">*</span>
          </label>
          <div className="flex gap-3">
            {(['男', '女', '未定'] as Gender[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setFormData({ ...formData, gender: g })}
                className={`flex-1 py-3 rounded-sm border transition-all duration-200
                  ${formData.gender === g
                    ? 'border-ink-800 bg-ink-900 text-ink-50'
                    : 'border-ink-200 text-ink-600 hover:border-ink-300 hover:bg-ink-50'
                  }`}
              >
                {g}
              </button>
            ))}
          </div>
        </section>

        {/* 出生时间 */}
        <section>
          <label className="block text-sm text-ink-600 mb-2">
            出生时间 <span className="text-ink-300 text-xs ml-1">(可选，用于八字分析)</span>
          </label>
          <input
            type="datetime-local"
            value={formData.birthTime}
            onChange={(e) => setFormData({ ...formData, birthTime: e.target.value })}
            className="input-field"
          />
        </section>

        {/* 期望寓意 */}
        <section>
          <label className="block text-sm text-ink-600 mb-2">
            期望寓意 <span className="text-ink-300 text-xs ml-1">(可选)</span>
          </label>
          <input
            type="text"
            value={formData.expectations}
            onChange={(e) => setFormData({ ...formData, expectations: e.target.value })}
            className="input-field"
            placeholder="如：聪明、有文采、品德高尚"
          />
          <div className="flex flex-wrap gap-2 mt-3">
            {expectationTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => {
                  const current = formData.expectations.split(/[,，、]/).filter(Boolean)
                  if (!current.includes(tag)) {
                    const newValue = current.length > 0 ? `${current.join('、')}${tag}` : tag
                    setFormData({ ...formData, expectations: newValue })
                  }
                }}
                className="px-3 py-1 text-sm text-ink-500 border border-ink-200 rounded-sm
                         hover:border-ink-300 hover:bg-ink-50 transition-all"
              >
                {tag}
              </button>
            ))}
          </div>
        </section>

        {/* 避免用字 */}
        <section>
          <label className="block text-sm text-ink-600 mb-2">
            避免用字 <span className="text-ink-300 text-xs ml-1">(可选)</span>
          </label>
          <input
            type="text"
            value={formData.avoidChars}
            onChange={(e) => setFormData({ ...formData, avoidChars: e.target.value })}
            className="input-field"
            placeholder="长辈名字、忌讳字等，用逗号分隔"
          />
        </section>

        {/* 取名模式 */}
        <section>
          <label className="block text-sm text-ink-600 mb-3">取名模式</label>
          <div className="grid grid-cols-4 gap-2">
            {(['传统', '文学', '现代', '混合'] as NamingMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setFormData({ ...formData, namingMode: mode })}
                className={`py-2.5 text-sm rounded-sm border transition-all duration-200
                  ${formData.namingMode === mode
                    ? 'border-vermilion-500 bg-vermilion-50 text-vermilion-700'
                    : 'border-ink-200 text-ink-600 hover:border-ink-300'
                  }`}
              >
                {mode}
              </button>
            ))}
          </div>
          <p className="text-xs text-ink-400 mt-2">
            {formData.namingMode === '传统' && '八字五行 + 三才五格 + 生肖宜忌'}
            {formData.namingMode === '文学' && '诗经楚辞取意 + 音韵美感'}
            {formData.namingMode === '现代' && '寓意优先 + 易读易写 + 避免生僻字'}
            {formData.namingMode === '混合' && '综合考虑以上所有因素'}
          </p>
        </section>

        {/* 字数偏好 */}
        <section>
          <label className="block text-sm text-ink-600 mb-3">字数偏好</label>
          <div className="flex gap-3">
            {[
              { value: 1, label: '单字名' },
              { value: 2, label: '双字名' },
              { value: '不限' as NameLength, label: '不限' },
            ].map(({ value, label }) => (
              <button
                key={label}
                type="button"
                onClick={() => setFormData({ ...formData, nameLength: value })}
                className={`flex-1 py-2.5 text-sm rounded-sm border transition-all duration-200
                  ${formData.nameLength === value
                    ? 'border-ink-800 bg-ink-900 text-ink-50'
                    : 'border-ink-200 text-ink-600 hover:border-ink-300'
                  }`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* 提交按钮 */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={!formData.surname || !formData.gender}
            className="w-full btn-accent disabled:opacity-40 disabled:cursor-not-allowed"
          >
            开始取名
          </button>
        </div>
      </form>
    </main>
  )
}
