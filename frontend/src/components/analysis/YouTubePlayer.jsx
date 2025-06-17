import React from 'react';
import YouTube from 'react-youtube';

function YouTubePlayer({ videoId, onPlayerReady }) {
  const opts = {
    height: '390',
    width: '100%', // Prendra toute la largeur de son conteneur
    playerVars: {
      // https://developers.google.com/youtube/player_parameters
      autoplay: 0,
    },
  };

  const _onReady = (event) => {
    // Passe l'objet "player" au composant parent pour qu'il puisse le contrôler.
    onPlayerReady(event.target);
  };

  return <YouTube videoId={videoId} opts={opts} onReady={_onReady} className="rounded-lg shadow-lg" />;
}

export default YouTubePlayer;