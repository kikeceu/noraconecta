import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface PublicProfile {
  name: string;
  categoryName: string;
  hasBadge: boolean;
  isVerified: boolean;
  photoUrl: string | null;
}

export function ProfessionalPublicPage() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showPhoto, setShowPhoto] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`${API_BASE}/professionals/${id}/public-profile`)
      .then((res) => {
        if (res.status === 404) {
          setNotFound(true);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) setProfile(data.data);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-white">
        <div className="h-8 w-8 animate-pulse rounded-full border-2 border-[#0B6E4F] border-t-transparent" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-white px-6 text-center">
        <p className="text-[#6B7280]" style={{ fontFamily: 'DM Sans' }}>
          No encontramos este profesional.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-start bg-[#F9FAFB] px-4 pt-12 pb-8">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-[#F3F4F6] p-8 flex flex-col items-center gap-5">

        {/* Photo */}
        {profile.photoUrl ? (
          <img
            src={profile.photoUrl}
            alt={profile.name}
            className="w-28 h-28 rounded-full object-cover border-4 border-[#E5E7EB] cursor-pointer"
            onClick={() => setShowPhoto(true)}
          />
        ) : (
          <div className="w-28 h-28 rounded-full bg-[#F3F4F6] border-4 border-[#E5E7EB] flex items-center justify-center">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
          </div>
        )}

        {/* Name and category */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#111827]" style={{ fontFamily: 'DM Sans' }}>
            {profile.name}
          </h1>
          <p className="text-sm text-[#6B7280] mt-1" style={{ fontFamily: 'DM Sans' }}>
            {profile.categoryName}
          </p>
        </div>

        {/* Badges */}
        <div className="flex flex-col items-center gap-2 w-full">
          {profile.isVerified && (
            <span className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium bg-[#ECFDF5] text-[#059669]" style={{ fontFamily: 'DM Sans' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Verificado por NORA
            </span>
          )}
          {profile.hasBadge && (
            <span className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium bg-[#FEF3C7] text-[#92400E]" style={{ fontFamily: 'DM Sans' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              Excelencia NORA
            </span>
          )}
        </div>

	// Modal:
	{showPhoto && (
	  <div
	    className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
	    onClick={() => setShowPhoto(false)}
	  >
	    <img
	      src={profile.photoUrl!}
	      alt={profile.name}
	      className="max-w-full max-h-full rounded-xl object-contain"
	    />
	  </div>
	)}

        {/* Footer */}
        <p className="text-xs text-[#9CA3AF] text-center mt-2" style={{ fontFamily: 'DM Sans' }}>
          Este profesional fue seleccionado por NORA para atender tu pedido.
        </p>
      </div>
    </div>
  );
}
