import type { BookOffer } from "@/lib/domain/types";

export function BookCover({ book, small = false }: { book: BookOffer; small?: boolean }) {
  return <div className={`book-cover ${small ? "book-small" : ""}`} style={{ "--book-color": book.color } as React.CSSProperties} aria-label={`${book.title} by ${book.author}`}>
    <div className="book-spine" />
    <div className="book-cover-content">
      <span className="book-edition">THE CIRCLE EDITION</span>
      <span className="book-title">{book.title}</span>
      <svg className="book-ornament" viewBox="0 0 100 65" aria-hidden="true"><circle cx="50" cy="31" r="24" /><path d="M12 56Q50-8 88 56M22 56Q50 8 78 56M32 56Q50 24 68 56M8 56h84" /></svg>
      <span className="book-author">{book.author}</span>
    </div>
  </div>;
}
