import { Search, MapPin, Calendar, Users, Star, Filter } from 'lucide-react';
import { motion } from 'framer-motion';

const mockHotels = [
  {
    id: 1,
    name: 'The Ritz-Carlton, Kyoto',
    location: 'Kyoto, Japan',
    image: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?ixlib=rb-4.0.3&auto=format&fit=crop&w=1740&q=80',
    price: 450,
    rating: 4.9,
    reviews: 128
  },
  {
    id: 2,
    name: 'Aman Venice',
    location: 'Venice, Italy',
    image: 'https://images.unsplash.com/photo-1510798831971-661eb04b3739?ixlib=rb-4.0.3&auto=format&fit=crop&w=774&q=80',
    price: 850,
    rating: 4.8,
    reviews: 94
  },
  {
    id: 3,
    name: 'Waldorf Astoria Maldives',
    location: 'Malé, Maldives',
    image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1740&q=80',
    price: 1200,
    rating: 5.0,
    reviews: 312
  }
];

export function HotelSearch() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <MapPin className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <input type="text" placeholder="Where to?" className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none" />
          </div>
          <div className="relative">
            <Calendar className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <input type="text" placeholder="Check in - Check out" className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none" />
          </div>
          <div className="relative">
            <Users className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <input type="text" placeholder="2 Adults, 1 Room" className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none" />
          </div>
          <button className="bg-primary-600 text-white py-2 rounded-xl hover:bg-primary-500 transition-colors flex items-center justify-center gap-2 font-medium">
            <Search className="h-5 w-5" />
            Search
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Filters Sidebar */}
        <div className="w-full md:w-64 flex-shrink-0">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm sticky top-24">
            <div className="flex items-center gap-2 mb-6 border-b pb-4">
              <Filter className="h-5 w-5 text-slate-500" />
              <h3 className="font-semibold text-slate-900">Filters</h3>
            </div>
            
            <div className="space-y-6">
              <div>
                <h4 className="font-medium text-sm text-slate-900 mb-3">Price Range</h4>
                <input type="range" className="w-full accent-primary-600" />
                <div className="flex justify-between text-xs text-slate-500 mt-2">
                  <span>$50</span>
                  <span>$2000+</span>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-sm text-slate-900 mb-3">Star Rating</h4>
                {[5, 4, 3].map(star => (
                  <label key={star} className="flex items-center gap-2 mb-2">
                    <input type="checkbox" className="rounded text-primary-600 focus:ring-primary-500" />
                    <div className="flex items-center">
                      {Array(star).fill(0).map((_, i) => <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />)}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 space-y-6">
          <div className="flex justify-between items-end">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Over 300 places to stay</h2>
              <p className="text-slate-500 text-sm mt-1">Explore our curated selection of premium hotels</p>
            </div>
          </div>

          <div className="space-y-6">
            {mockHotels.map((hotel, index) => (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                key={hotel.id} 
                className="bg-white rounded-2xl border border-slate-100 overflow-hidden flex flex-col sm:flex-row hover:shadow-xl hover:shadow-slate-200/50 transition-all group"
              >
                <div className="h-64 sm:h-auto sm:w-72 relative overflow-hidden">
                  <img src={hotel.image} alt={hotel.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-1 text-slate-500 text-sm mb-1">
                          <MapPin className="h-4 w-4" /> {hotel.location}
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">{hotel.name}</h3>
                      </div>
                      <div className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-lg">
                        <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                        <span className="font-semibold text-amber-700">{hotel.rating}</span>
                      </div>
                    </div>
                    <p className="text-slate-500 text-sm mt-4 line-clamp-2">
                      Experience luxury and comfort at its finest. This property offers exceptional amenities and world-class service to ensure an unforgettable stay.
                    </p>
                  </div>
                  
                  <div className="flex justify-between items-end mt-6 pt-6 border-t border-slate-100">
                    <div>
                      <p className="text-sm text-slate-500">Price per night</p>
                      <p className="text-2xl font-bold text-slate-900">${hotel.price}</p>
                    </div>
                    <button className="bg-slate-900 text-white px-6 py-2 rounded-xl hover:bg-slate-800 transition-colors shadow-md">
                      View Details
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
