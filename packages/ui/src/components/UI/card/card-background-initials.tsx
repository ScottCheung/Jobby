"use client"



interface CardBackgroundInitialsProps {
    name: string
}

export function CardBackgroundInitials({ name }: CardBackgroundInitialsProps) {
    const initials = name.split(' ').length > 1
        ? name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
        : name.slice(0, 2).toUpperCase();

    return (
        <div

            className="absolute right-0 top-0 p-6"
        >
            <span className="opacity-5  group:transition-all duration-1000  group-hover:scale-105 scale-100 group-hover:opacity-10 text-8xl font-bold text-primary block">
                {initials}
            </span>
        </div>
    )
}