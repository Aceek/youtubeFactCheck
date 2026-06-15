import Icon from '../common/Icon';

function VideoInfo({ video }) {
  if (!video) return null;

  return (
    <div className="panel flex flex-col gap-5 p-5 md:flex-row md:items-start">
      {video.thumbnailUrl && (
        <div className="relative w-full shrink-0 overflow-hidden rounded-xl border border-line md:w-64">
          <img src={video.thumbnailUrl} alt="Content thumbnail" className="h-auto w-full object-cover" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <h2 className="text-xl font-bold leading-snug text-ink">{video.title || 'Untitled'}</h2>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Icon name="film" className="h-4 w-4 text-faint" />
            <span className="font-medium text-ink">{video.author || 'Unknown author'}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Icon name="clock" className="h-4 w-4 text-faint" />
            {video.publishedAt ? new Date(video.publishedAt).toLocaleDateString('en-US') : 'Unknown date'}
          </span>
        </div>

        {video.description && (
          <div className="scrollbar-thin mt-4 max-h-28 overflow-y-auto rounded-lg border border-line bg-base/40 p-3 text-sm leading-relaxed text-muted whitespace-pre-wrap">
            {video.description}
          </div>
        )}
      </div>
    </div>
  );
}

export default VideoInfo;
