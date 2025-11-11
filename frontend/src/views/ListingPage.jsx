// src/views/ListingPage.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import supabase from "../lib/supabaseClient";
import { formatTimeLeftMs } from "../utils/time";
import {
  getWatchCount,
  isUserWatching,
  toggleWatch,
  subscribeWatchCount,
} from "../controllers/watchController";
import {
  getCurrentBidWithUser,
  raiseBid,
  getBidder,
} from "../controllers/profileController";
import {
  Home,
  Clock,
  Eye,
  Gavel,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";

export default function ListingPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [auction, setAuction] = useState(null);
  const [images, setImages] = useState([]); // array of URLs
  const [currentIndex, setCurrentIndex] = useState(0);

  const [currentBid, setCurrentBid] = useState(null);
  const [bidAmount, setBidAmount] = useState("");
  const [watching, setWatching] = useState(false);
  const [watchCount, setWatchCount] = useState(0);
  const [isSeller, setIsSeller] = useState(false);
  const [bidHistory, setBidHistory] = useState([]);
  const [timeRemaining, setTimeRemaining] = useState("--:--:--");

  const [showLightbox, setShowLightbox] = useState(false);

  // Initial data + realtime
  useEffect(() => {
    if (!id) return;

    loadAuction();
    loadBidInfo();
    loadWatchInfo();
    loadBidHistory();
    loadImages();

    const unsubscribeWatch = subscribeWatchCount(id, () => loadWatchInfo());

    const bidChannel = supabase
      .channel(`bids-${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bids",
          filter: `auction_id=eq.${id}`,
        },
        () => {
          loadBidInfo();
          loadBidHistory();
        }
      )
      .subscribe();

    return () => {
      unsubscribeWatch();
      supabase.removeChannel(bidChannel);
    };
  }, [id]);

  // Countdown
  useEffect(() => {
    if (!auction?.end_time) {
      setTimeRemaining("--:--:--");
      return;
    }

    const endMs = new Date(auction.end_time).getTime();

    const updateCountdown = () => {
      setTimeRemaining(formatTimeLeftMs(endMs));
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [auction?.end_time]);

  async function loadAuction() {
    const { data, error } = await supabase
      .from("auctions")
      .select("*, profiles(username)")
      .eq("id", id)
      .maybeSingle();

    if (!error && data) {
      setAuction({ ...data, seller: data.profiles?.username || "Unknown" });

      const session = await supabase.auth.getSession();
      const uid = session?.data?.session?.user?.id;
      setIsSeller(uid === data.seller_id);
    }
  }

  async function loadImages() {
    const { data, error } = await supabase
      .from("images")
      .select("url, uploaded_at")
      .eq("auction_id", id)
      .order("uploaded_at", { ascending: true });

    if (!error && data) {
      const urls = data.map((row) => row.url).filter(Boolean);
      setImages(urls);
      setCurrentIndex(0);
    }
  }

  async function loadBidInfo() {
    const info = await getCurrentBidWithUser(id);
    setCurrentBid(info);
  }

  async function loadWatchInfo() {
    const count = await getWatchCount(id);
    setWatchCount(count);

    const session = await supabase.auth.getSession();
    const uid = session?.data?.session?.user?.id;
    if (uid) {
      const mine = await isUserWatching(id, uid);
      setWatching(mine);
    }
  }

  async function loadBidHistory() {
    const { data, error } = await supabase
      .from("bids")
      .select("bid_amount, bidder_id, created_at")
      .eq("auction_id", id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      const enriched = await Promise.all(
        data.map(async (b) => ({
          ...b,
          username: await getBidder(b.bidder_id),
        }))
      );
      setBidHistory(enriched);
    }
  }

  async function handleBid() {
    const session = await supabase.auth.getSession();
    const uid = session?.data?.session?.user?.id;
    if (!uid) return alert("Sign in to bid.");
    if (isSeller) return alert("You cannot bid on your own auction.");

    await raiseBid(id, bidAmount, uid);
    setBidAmount("");
    loadBidInfo();
    loadBidHistory();
  }

  async function handleWatch() {
    const session = await supabase.auth.getSession();
    const uid = session?.data?.session?.user?.id;
    if (!uid) return alert("Sign in to watch this item.");

    const newState = await toggleWatch(id, uid);
    setWatching(newState);
    loadWatchInfo();
  }

  function goPrevImage() {
    if (images.length < 2) return;
    setCurrentIndex((idx) => (idx - 1 + images.length) % images.length);
  }

  function goNextImage() {
    if (images.length < 2) return;
    setCurrentIndex((idx) => (idx + 1) % images.length);
  }

  function openLightbox() {
    if (!images.length) return;
    setShowLightbox(true);
  }

  function closeLightbox() {
    setShowLightbox(false);
  }

  // Keyboard controls for lightbox (Left / Right / Esc)
  useEffect(() => {
    if (!showLightbox) return;

    const handleKeyDown = (e) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrevImage();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNextImage();
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeLightbox();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showLightbox]);

  if (!auction) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600">
        Loading auction…
      </div>
    );
  }

  const reserveMet =
    currentBid && auction.reserve_price != null
      ? currentBid.amount >= auction.reserve_price
      : false;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-50">
      <div className="max-w-6xl mx-auto p-6">
        {/* Top Bar */}
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow transition"
          >
            <Home className="w-4 h-4" />
            Back to Home
          </button>
          <div className="text-sm text-gray-500">
            Home / Listing /{" "}
            <span className="text-gray-700">{auction.title}</span>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 space-y-6 transition-all hover:shadow-2xl">
          <h1 className="text-3xl font-bold text-gray-900 text-center">
            {auction.title}
          </h1>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Image area */}
            <div className="flex-1">
              <div
                className="relative group overflow-hidden rounded-xl shadow-md border border-gray-300 bg-gray-50 cursor-zoom-in"
                onClick={openLightbox}
              >
                {images.length > 0 ? (
                  <>
                    <img
                      src={images[currentIndex]}
                      alt={auction.title}
                      className="w-full h-96 object-cover transition-transform duration-500 group-hover:scale-105"
                    />

                    {/* Image counter (non-enlarged) */}
                    {images.length > 1 && (
                      <div className="absolute bottom-3 right-3 bg-black/50 text-white text-xs px-2 py-1 rounded-full shadow-sm">
                        {currentIndex + 1} / {images.length}
                      </div>
                    )}

                    {images.length > 1 && (
                      <>
                        {/* Left arrow (non-enlarged) */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            goPrevImage();
                          }}
                          className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/70 text-white rounded-full p-2 shadow-md transition opacity-0 group-hover:opacity-100 backdrop-blur-sm"
                        >
                          <ChevronLeft className="w-6 h-6" />
                        </button>

                        {/* Right arrow (non-enlarged) */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            goNextImage();
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/70 text-white rounded-full p-2 shadow-md transition opacity-0 group-hover:opacity-100 backdrop-blur-sm"
                        >
                          <ChevronRight className="w-6 h-6" />
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  <div className="w-full h-96 flex items-center justify-center text-gray-400 text-sm">
                    No images available
                  </div>
                )}
              </div>

              {/* Thumbnail strip */}
              {images.length > 1 && (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {images.map((url, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCurrentIndex(idx)}
                      className={`border rounded-md overflow-hidden flex-shrink-0 ${
                        idx === currentIndex
                          ? "border-blue-600 ring-2 ring-blue-400"
                          : "border-gray-300 hover:border-blue-400"
                      }`}
                    >
                      <img
                        src={url}
                        alt={`Thumbnail ${idx + 1}`}
                        className="w-20 h-20 object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right side: bid + watchers */}
            <aside className="w-full lg:w-80 space-y-4">
              {/* Bid Panel */}
              <div className="border rounded-xl p-5 bg-gray-50 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <span>Time left:</span>
                  <span className="font-semibold">{timeRemaining}</span>
                </div>

                <div>
                  <div className="text-sm text-gray-600 mb-1 flex items-center gap-2">
                    <Gavel className="w-4 h-4 text-gray-500" />
                    <span>Current bid</span>
                  </div>
                  <div className="text-3xl font-bold text-blue-700">
                    {currentBid
                      ? `$${currentBid.amount}`
                      : `$${auction.starting_price ?? 0}`}
                  </div>
                  {currentBid && (
                    <div className="text-xs text-gray-500 mt-1">
                      Highest bidder: {currentBid.username}
                    </div>
                  )}
                </div>

                {auction.reserve_price != null && (
                  <div className="text-xs text-gray-600">
                    Reserve: ${auction.reserve_price}{" "}
                    <span
                      className={`ml-1 font-medium ${
                        reserveMet ? "text-green-600" : "text-red-500"
                      }`}
                    >
                      {reserveMet ? "(met)" : "(not met)"}
                    </span>
                  </div>
                )}

                {!isSeller && (
                  <div className="pt-2 space-y-2">
                    <input
                      type="number"
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Enter your bid"
                      min="0"
                      step="0.01"
                    />
                    <button
                      type="button"
                      onClick={handleBid}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-md shadow-md"
                    >
                      Place Bid
                    </button>
                  </div>
                )}

                {isSeller && (
                  <p className="text-xs text-gray-500 pt-2">
                    You are the seller of this item.
                  </p>
                )}
              </div>

              {/* Watchers */}
              <div className="border rounded-xl p-5 bg-gray-50 shadow-sm text-sm">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-gray-500" />
                  <span className="font-semibold">Watchers:</span>
                  <span>{watchCount}</span>
                </div>
                <button
                  type="button"
                  onClick={handleWatch}
                  className="mt-2 w-full border rounded-md bg-white hover:bg-blue-50 text-blue-600 font-medium py-1.5 transition"
                >
                  {watching ? "Unwatch" : "Watch this item"}
                </button>
              </div>
            </aside>
          </div>

          {/* Description */}
          <section className="border-top pt-6">
            <h2 className="text-lg font-semibold mb-2 text-gray-800">
              Description
            </h2>
            <p className="text-gray-700 text-sm leading-relaxed">
              {auction.description || "No description provided."}
            </p>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-700">
              <div>
                <strong>Seller:</strong> {auction.seller}
              </div>
              <div>
                <strong>Location:</strong>{" "}
                {auction.location || "Not specified"}
              </div>
              <div>
                <strong>Type:</strong> {auction.auction_type || "standard"}
              </div>
              <div>
                <strong>Ends:</strong>{" "}
                {auction.end_time
                  ? new Date(auction.end_time).toLocaleString()
                  : "Unknown"}
              </div>
            </div>
          </section>

          {/* Bid History */}
          <section className="border-t pt-6">
            <h2 className="text-lg font-semibold mb-3 text-gray-800">
              Bid History
            </h2>
            {bidHistory.length === 0 ? (
              <div className="text-sm text-gray-600 italic">No bids yet.</div>
            ) : (
              <ul className="text-sm space-y-1 max-h-64 overflow-y-auto border rounded-md bg-gray-50 p-2">
                {bidHistory.map((b, i) => (
                  <li
                    key={i}
                    className="flex justify-between border-b last:border-b-0 py-1"
                  >
                    <span className="font-medium">{b.username}</span>
                    <span className="text-gray-700">
                      ${b.bid_amount} ·{" "}
                      {new Date(b.created_at).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {/* Lightbox */}
      {showLightbox && images.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center"
          onClick={closeLightbox}
        >
          <div
            className="relative max-w-5xl w-full px-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeLightbox}
              className="absolute -top-10 right-0 text-white hover:text-blue-200 transition"
            >
              <X className="w-6 h-6 stroke-[2.5]" />
            </button>

            <div className="relative bg-black rounded-lg overflow-hidden flex items-center justify-center">
              {/* Image counter (lightbox) */}
              {images.length > 1 && (
                <div className="absolute top-3 left-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full shadow-sm">
                  {currentIndex + 1} / {images.length}
                </div>
              )}

              {/* Left arrow (lightbox) */}
              <button
                type="button"
                onClick={goPrevImage}
                className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/70 text-white rounded-full p-3 shadow-lg transition backdrop-blur-sm"
              >
                <ChevronLeft className="w-7 h-7" />
              </button>

              <img
                src={images[currentIndex]}
                alt={auction.title}
                className="max-h-[80vh] w-full object-contain bg-black"
              />

              {/* Right arrow (lightbox) */}
              <button
                type="button"
                onClick={goNextImage}
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/70 text-white rounded-full p-3 shadow-lg transition backdrop-blur-sm"
              >
                <ChevronRight className="w-7 h-7" />
              </button>
            </div>

            {/* Lightbox thumbnails */}
            {images.length > 1 && (
              <div className="mt-3 flex gap-2 justify-center">
                {images.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    className={`border rounded-md overflow-hidden ${
                      idx === currentIndex
                        ? "border-blue-400 ring-2 ring-blue-300"
                        : "border-gray-300 hover:border-blue-300"
                    }`}
                  >
                    <img
                      src={url}
                      alt={`Preview ${idx + 1}`}
                      className="w-16 h-16 object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
