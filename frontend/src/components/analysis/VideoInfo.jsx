import React from 'react';

function VideoInfo({ video }) {
  if (!video) return null;

  return (
    <div className="bg-black/30 p-6 rounded-xl shadow-2xl border border-cyan-400/20 backdrop-blur-lg flex flex-col md:flex-row gap-6 items-start">
      {video.thumbnailUrl && (
        <img
          src={video.thumbnailUrl}
          alt="Miniature de la vidéo"
          className="w-full md:w-56 h-auto object-cover rounded-lg shadow-lg border-2 border-cyan-400/30"
        />
      )}
      <div className="flex-1">
        <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-fuchsia-400 mb-3">
          {video.title || 'Titre non disponible'}
        </h2>
        <p className="text-md text-cyan-200/80 mb-2">
          Par : <span className="font-semibold text-white">{video.author || 'Auteur non disponible'}</span>
        </p>
        <p className="text-md text-cyan-200/80 mb-4">
          Publiée le : <span className="font-semibold text-white">
            {video.publishedAt ? new Date(video.publishedAt).toLocaleDateString('fr-FR') : 'Date inconnue'}
          </span>
        </p>
        <div className="max-h-32 overflow-y-auto p-4 bg-gray-900/60 rounded-lg border border-gray-700 text-sm text-gray-300 whitespace-pre-wrap scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
          {video.description || 'Pas de description.'}
        </div>
      </div>
    </div>
  );
}

export default VideoInfo;