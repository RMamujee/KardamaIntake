export default function SuccessScreen({ type, name }) {
  const firstName = name.split(' ')[0]

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-cyan-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="bg-white rounded-3xl shadow-xl shadow-teal-100 p-10">
          <div className="w-20 h-20 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            You're all set, {firstName}!
          </h2>
          <p className="text-gray-500 mb-6 leading-relaxed">
            {type === 'cleaner'
              ? "We've received your cleaner application. Our team will review it and reach out within 1–2 business days."
              : "We've received your cleaning request. Our team will be in touch shortly to confirm your schedule."}
          </p>
          <div className="p-4 bg-teal-50 rounded-2xl">
            <p className="text-teal-700 text-sm font-medium">
              A summary has been added to our calendar — we'll be in touch soon.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
