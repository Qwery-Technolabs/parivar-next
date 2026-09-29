import {
    Ambulance, Apple, Award, Baby, Banknote, BarChart3, Bell, Bike, Bird, BookOpen, Briefcase, Building,
    Building2, Bus, CakeSlice, Calculator, CalendarDays, Camera, Car, Carrot, Castle, Church, Coffee, Cog,
    Coins, Construction, Container, Crown, Droplet, Droplets, Drum, Dumbbell, Factory, Flag, Flame, Flower,
    Flower2, Fuel, Gavel, Gem, Gift, Globe, GraduationCap, Guitar, Hammer, HandCoins, HandHeart, HandHelping,
    Handshake, HardHat, Heart, HeartHandshake, HeartPulse, Home, Hospital, Hotel, IndianRupee, Infinity, Key,
    Landmark, Laptop, Leaf, Library, Lightbulb, Mail, MapPin, Medal, Megaphone, Mic, Microscope, Milk, Moon,
    Mountain, Music, Newspaper, Package, Paintbrush, Palette, PartyPopper, PawPrint, Phone, PiggyBank, Pill,
    Plane, Presentation, Receipt, Rocket, Scale, School, Scissors, ScrollText, Shield, ShieldCheck, Ship, Shirt,
    ShoppingBag, ShoppingCart, Smartphone, Sparkles, Sprout, Stamp, Star, Stethoscope, Store, Sun, Sunrise,
    Target, Tent, Ticket, Tractor, TrainFront, TreePine, Trees, TrendingUp, Trophy, Truck, Users, UsersRound,
    Utensils, Vote, Wallet, Warehouse, Wheat, Wrench,
} from 'lucide-react';
import { avatarInk } from '@/lib/group-avatar';

/** Lucide components by the names stored in AVATAR_ICONS (lib/group-avatar.js). */
export const AVATAR_ICON_MAP = {
    Ambulance, Apple, Award, Baby, Banknote, BarChart3, Bell, Bike, Bird, BookOpen, Briefcase, Building,
    Building2, Bus, CakeSlice, Calculator, CalendarDays, Camera, Car, Carrot, Castle, Church, Coffee, Cog,
    Coins, Construction, Container, Crown, Droplet, Droplets, Drum, Dumbbell, Factory, Flag, Flame, Flower,
    Flower2, Fuel, Gavel, Gem, Gift, Globe, GraduationCap, Guitar, Hammer, HandCoins, HandHeart, HandHelping,
    Handshake, HardHat, Heart, HeartHandshake, HeartPulse, Home, Hospital, Hotel, IndianRupee, Infinity, Key,
    Landmark, Laptop, Leaf, Library, Lightbulb, Mail, MapPin, Medal, Megaphone, Mic, Microscope, Milk, Moon,
    Mountain, Music, Newspaper, Package, Paintbrush, Palette, PartyPopper, PawPrint, Phone, PiggyBank, Pill,
    Plane, Presentation, Receipt, Rocket, Scale, School, Scissors, ScrollText, Shield, ShieldCheck, Ship, Shirt,
    ShoppingBag, ShoppingCart, Smartphone, Sparkles, Sprout, Stamp, Star, Stethoscope, Store, Sun, Sunrise,
    Target, Tent, Ticket, Tractor, TrainFront, TreePine, Trees, TrendingUp, Trophy, Truck, Users, UsersRound,
    Utensils, Vote, Wallet, Warehouse, Wheat, Wrench,
};

// Fallback tints when no colour was chosen (text colours ≥4.5:1 on their tint).
const TINTS = ['bg-blue-50 text-blue-800', 'bg-emerald-50 text-emerald-700', 'bg-rose-50 text-rose-700', 'bg-purple-50 text-purple-800', 'bg-amber-50 text-amber-800', 'bg-teal-50 text-teal-700'];

/**
 * A group's avatar — icon, emoji or ≤2 letters on its colour; with nothing chosen, the
 * group's first letter on a tint. No hooks, so it renders in server and client components.
 * @param {{ id?: number, name: string, kind?: string, value?: string, color?: string, size?: 'sm'|'md'|'lg', tint?: string, className?: string }} props
 *   tint — classes used when no colour is chosen (default: a light tint picked by id)
 */
export default function GroupAvatar({ id = 0, name = '', kind, value, color, size = 'md', tint, className = '' }) {
    const dim = { sm: 'size-8 text-sm', md: 'size-10 text-base', lg: 'size-11 text-base' }[size];
    const iconSize = { sm: 'size-4', md: 'size-5', lg: 'size-6' }[size];
    const Icon = kind === 'icon' ? AVATAR_ICON_MAP[value] : null;
    const label = (kind === 'emoji' || kind === 'text') && value ? value : name.trim().charAt(0).toUpperCase();
    const tone = color ? '' : (tint ?? TINTS[id % TINTS.length]);

    return (
        <span
            aria-hidden
            style={color ? { backgroundColor: color, color: avatarInk(color) } : undefined}
            className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${dim} ${tone} ${className}`}
        >
            {Icon ? <Icon className={iconSize} /> : <span className="leading-none">{label}</span>}
        </span>
    );
}
