import React from 'react';

function VideoInfo({ video }) {
  if (!video) return null;

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700 flex flex-col md:flex-row gap-6">
      {video.thumbnailUrl && (
        <img 
          src={video.thumbnailUrl} 
          alt="Miniature de la vidéo" 
          className="w-full md:w-48 h-auto object-cover rounded-md self-start"
        />
      )}
      <div className="flex-1">
        <h2 className="text-xl font-bold text-cyan-400 mb-2">{video.title || "Titre non disponible"}</h2>
        <p className="text-sm text-gray-400 mb-1">Par : <span className="font-semibold text-gray-300">{video.author || "Auteur non disponible"}</span></p>
        <p className="text-sm text-gray-400 mb-4">Publiée le : <span className="font-semibold text-gray-300">
          {video.publishedAt ? new Date(video.publishedAt).toLocaleDateString('fr-FR') : "Date inconnue"}
        </span></p>
        <div className="max-h-24 overflow-y-auto p-3 bg-gray-900/50 rounded-md border border-gray-700">
          <p className="text-xs text-gray-300 whitespace-pre-wrap">
            {video.description || "Pas de description."}
          </p>
        </div>
      </div>
    </div>
  );
}

export default VideoInfo;