export default function LoadingSpinner() {
  return (
    <div className="flex items-center gap-2">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-teal-300 border-t-teal-600" />
      <span className="text-sm text-gray-500">Analyzing reaction...</span>
    </div>
  );
}
