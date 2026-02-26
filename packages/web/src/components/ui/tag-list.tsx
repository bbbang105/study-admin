interface TagListProps {
  tags: string[];
  limit?: number;
}

export function TagList({ tags, limit = 4 }: TagListProps) {
  if (!tags || tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {tags.slice(0, limit).map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-primary/10 text-primary"
        >
          {tag}
        </span>
      ))}
      {tags.length > limit && (
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-muted text-muted-foreground">
          +{tags.length - limit}
        </span>
      )}
    </div>
  );
}
