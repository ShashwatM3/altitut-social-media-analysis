/**
 * The public `/socials` surface is pure white, unlike the grey internal
 * dashboard shell, so it opts out of the body background.
 */
export default function SocialsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="min-h-screen bg-white text-dark-grey">{children}</div>;
}
