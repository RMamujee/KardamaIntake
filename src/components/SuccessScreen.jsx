export default function SuccessScreen({ name, businessName }) {
  const firstName = name.split(' ')[0]

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-cyan-50 flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-md text-center">
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl shadow-teal-100 p-6 sm:p-10">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">
            You're all set, {firstName}!
          </h2>
          <p className="text-gray-500 mb-6 leading-relaxed text-sm sm:text-base">
            We've received your cleaning request. {businessName} will be in touch shortly to confirm your schedule.
          </p>
          <div className="p-4 bg-teal-50 rounded-2xl">
            <p className="text-teal-700 text-sm font-medium">
              We'll reach out within one business day to confirm your time.
            </p>
          </div>
        </div>
        <p className="text-center text-xs text-gray-400 mt-4">
          Need to <a href="/?cancel=1" className="text-teal-500 hover:underline">cancel or reschedule</a>?
        </p>
        <p className="text-center text-xs text-gray-300 mt-2">
          Powered by <span className="font-medium text-teal-400">Kardama</span>
        </p>
      </div>
    </div>
  )
}
