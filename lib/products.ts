import { catalogProducts } from "./catalog";
import { imageForName, img } from "./images";

export type Collection = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  image: string;
};

export type Product = {
  slug: string;
  name: string;
  sku: string;
  price: number;
  compareAt?: number;
  rating: number;
  reviews: number;
  stock: "in-stock" | "low" | "made-to-order";
  collection: string;
  category?: string;
  subcategory?: string;
  badge?: string;
  image: string;
  gallery: string[];
  finish: string;
  material: string;
  dimensions: string;
  weight: string;
  packaging: string;
  included: string[];
  description: string;
  story: string;
  wholesaleFrom?: number;
  freeShipping?: boolean;
  moq?: number;
  featured?: boolean;
  /** Units on hand. When 1–5, the shop shows a low-stock alert. */
  quantity?: number;
  /** Manually unavailable on the customer/B2C shop. */
  b2cOutOfStock?: boolean;
  /** Manually unavailable on the wholesale/B2B shop. */
  b2bOutOfScope?: boolean;
  /** Shop-now category slugs this product is listed under. */
  categories?: string[];
  imageAdjust?: {
    zoom: number;
    brightness: number;
    contrast: number;
    exposure?: number;
    shadows?: number;
    highlights?: number;
    blacks?: number;
    whites?: number;
    saturation?: number;
    temperature?: number;
    sharpness?: number;
    clarity?: number;
  };
  colors?: string[];
  materials?: string[];
  sizes?: string[];
  /** Named photos. Each color opens that photo; text is drawn on the image. */
  listingImages?: {
    url: string;
    name: string;
    color: string;
    text: string;
    textX?: number;
    textY?: number;
    adjust?: Product["imageAdjust"];
  }[];
  tags?: string[];
  priceIndia?: number;
  priceUs?: number;
  /** Buyer-facing note while a shop-wide sale includes this listing. */
  saleTerms?: string;
  /** Percent off from a running admin sale (set by applySales). */
  salePercent?: number;
  /** Extra charge when the buyer chooses personalisation. Hidden when unset. */
  personalisationPrice?: number;
};

export const collections: Collection[] = [
  {
    slug: "nautical-instruments",
    name: "Nautical Instruments",
    tagline: "Heritage navigation",
    description:
      "Museum-grade sextants, astrolabes, hourglasses and navigational instruments hand-finished in solid brass.",
    image: img.compassMap,
  },
  {
    slug: "brass-compasses",
    name: "Brass Compasses",
    tagline: "True north, in brass",
    description:
      "Pocket, desk and gimbal compasses inspired by Royal Navy instruments — engraved, aged and gift-ready.",
    image: img.compassGold,
  },
  {
    slug: "brass-binoculars",
    name: "Brass Binoculars",
    tagline: "Officer’s field glass",
    description:
      "Antique-finish binoculars and opera glasses with leather wraps, perfect for décor and gifting.",
    image: img.binoculars,
  },
  {
    slug: "telescopes",
    name: "Telescopes",
    tagline: "Spyglass & stand",
    description:
      "Leather-wrapped spyglasses and standing brass telescopes for study, yacht and display.",
    image: img.telescope,
  },
  {
    slug: "nautical-decor",
    name: "Nautical Décor",
    tagline: "Harbour at home",
    description:
      "Anchors, lanterns, porthole mirrors, bells and diving helmets for hotels, clubs and residences.",
    image: img.lanternVintage,
  },
  {
    slug: "walking-canes",
    name: "Walking Canes",
    tagline: "A gentleman’s companion",
    description:
      "Hardwood shafts with solid brass handles — compass, anchor and skull motifs, gift boxed.",
    image: img.antiques2,
  },
  {
    slug: "ship-wheels",
    name: "Ship Wheels",
    tagline: "Take the helm",
    description:
      "Hand-spoked teak and brass ship wheels from 18\" accent pieces to 36\" statement helms.",
    image: img.sail,
  },
  {
    slug: "custom-manufacturing",
    name: "Custom Manufacturing",
    tagline: "Your mark, our craft",
    description:
      "OEM / ODM brass work from India — logos, sizes, finishes and packaging to your specification.",
    image: img.workshop,
  },
  {
    slug: "new-arrivals",
    name: "New Arrivals",
    tagline: "Just from the foundry",
    description:
      "The newest pieces from our Roorkee factory — limited runs, new finishes and seasonal gift sets.",
    image: img.compassBrass,
  },
  {
    slug: "armor-breast-plate",
    name: "Armor Breast Plate",
    tagline: "Steel & brass plate",
    description: "Wearable and display breast plates, jackets and gauntlets finished for collectors and film.",
    image: img.armor,
  },
  {
    slug: "armor-helmets",
    name: "Armor Helmets",
    tagline: "Centurion to knight",
    description: "Roman, Corinthian, Norman and medieval helmets in steel and brass.",
    image: img.helmet,
  },
  {
    slug: "muscle-armour",
    name: "Muscle Armour",
    tagline: "Classical cuirass",
    description: "Greek and Roman muscle armour, leather cuirass and companion shields.",
    image: img.knight,
  },
  {
    slug: "armory-props",
    name: "Armory Props",
    tagline: "Shield, mail & belt",
    description: "Medieval shields, chainmail, legion belts, gauntlets and shoulder armour.",
    image: img.armor,
  },
  {
    slug: "diving-helmets",
    name: "Diving Helmets",
    tagline: "Mark-style brass",
    description: "Decorative diving helmets for lobbies, yachts and collector rooms.",
    image: img.diving,
  },
  {
    slug: "spotlight-searchlight",
    name: "Searchlights",
    tagline: "Lamp & spotlight",
    description: "Brass table lamps, floor lamps and marine searchlights.",
    image: img.lanternVintage,
  },
  {
    slug: "clocks",
    name: "Clocks & Watches",
    tagline: "Pocket and desk",
    description: "Nautical pocket watches, brass table clocks and desk timepieces.",
    image: img.watch,
  },
  {
    slug: "ship-bell",
    name: "Ship Bells",
    tagline: "Hand, hang, desk",
    description: "Hand bells, hanging ship bells and desk bells in solid brass.",
    image: img.ship,
  },
  {
    slug: "full-suit-of-armor",
    name: "Full Suit of Armor",
    tagline: "Display & wearable",
    description: "Full suits of armor in 18 gauge steel — polished, blackened or antique.",
    image: img.knight,
  },
  {
    slug: "magnifying-glass",
    name: "Magnifiers",
    tagline: "Chart glass",
    description: "Antique brass magnifying glasses with turned handles for desk and gifting.",
    image: img.magnifier,
  },
  {
    slug: "modern-brass-wall-sconce",
    name: "Modern Brass Wall Sconce",
    tagline: "Wall light in brass",
    description:
      "Modern brass wall sconces for hallways, hotels and dining rooms — fluted ceramic, arched dome and cone finishes.",
    image: "/sconce-dome.jpg",
  },
  {
    slug: "lighting-lamps",
    name: "Lighting lamps",
    tagline: "Ceiling to garden",
    description:
      "Brass and mixed-metal lighting — ceiling and hanging lights, wall lights, table lamps, spot lights, picture lights, bathroom lights, flush mounts, floor lamps, chandeliers, rechargeable lamps and outdoor lights.",
    image: img.lightCeiling,
  },
  {
    slug: "jewellery",
    name: "Brass Jewellery",
    tagline: "Handcrafted adornments",
    description:
      "Hand-finished brass bangles, bracelets, statement necklaces, clasp clutches and jewellery boxes from our Roorkee artisans.",
    image: img.jewelryGold,
  },
].map((c) => ({ ...c, image: imageForName(c.name, c.image) }));

const coreProducts: Product[] = [
  {
    slug: "antique-brass-nautical-compass",
    name: "Antique Brass Nautical Compass",
    sku: "MM-CMP-001",
    price: 39,
    rating: 4.8,
    reviews: 128,
    stock: "in-stock",
    collection: "brass-compasses",
    badge: "Bestseller",
    image: img.compassMap,
    gallery: [img.compassMap, img.compassGold, img.compassBrass, img.magnifier],
    finish: "Antique patina",
    material: "Solid brass",
    dimensions: '3.2" Dia × 1.2" Ht',
    weight: "220 g",
    packaging: "Premium gift box",
    included: ["Compass", "Velvet pouch", "Care card", "Gift box"],
    description:
      "A beautifully crafted pocket compass in solid brass, hand-aged to a warm antique patina. Designed for nautical interiors and collectors who want a working instrument that still looks as if it sailed the 19th century.",
    story:
      "Each lid is hinged, polished and then darkened by hand in our Roorkee factory. The rose is printed on a sealed card, the needle is balanced, and the case closes with a satisfying click — a small ritual of craft.",
    wholesaleFrom: 18,
    moq: 50,
    featured: true,
  },
  {
    slug: "royal-navy-pocket-compass",
    name: "Royal Navy Pocket Compass",
    sku: "MM-CMP-014",
    price: 45,
    rating: 4.9,
    reviews: 86,
    stock: "in-stock",
    collection: "brass-compasses",
    image: img.compassGold,
    gallery: [img.compassGold, img.compassBrass, img.compassMap],
    finish: "Polished brass",
    material: "Solid brass & glass",
    dimensions: '2.8" Dia × 0.9" Ht',
    weight: "180 g",
    packaging: "Leather sleeve",
    included: ["Compass", "Leather sleeve", "Gift box"],
    description:
      "A slim officer-style pocket compass with a sprung lid and luminous rose. Engraving-ready for retail and wholesale programmes.",
    story: "Modelled on instruments issued to merchant officers in the 1920s.",
    wholesaleFrom: 21,
    moq: 50,
    featured: true,
  },
  {
    slug: "gimbal-desk-compass",
    name: "Gimbal Desk Compass",
    sku: "MM-CMP-022",
    price: 89,
    rating: 4.7,
    reviews: 41,
    stock: "in-stock",
    collection: "brass-compasses",
    badge: "Desk icon",
    image: img.compassBrass,
    gallery: [img.compassBrass, img.compassMap, img.globe],
    finish: "Aged brass on teak",
    material: "Brass, teak, glass",
    dimensions: '6.5" × 6.5" × 4"',
    weight: "780 g",
    packaging: "Crate-style box",
    included: ["Gimbal compass", "Teak base", "Care kit"],
    description:
      "A two-axis gimbal compass mounted on a teak plinth — the piece that anchors a captain’s desk or hotel suite.",
    story: "Gimbals are assembled and balanced by a single craftsman.",
    wholesaleFrom: 48,
    moq: 24,
    featured: true,
  },
  {
    slug: "officer-brass-binoculars",
    name: "Officer Brass Binoculars",
    sku: "MM-BIN-008",
    price: 129,
    rating: 4.6,
    reviews: 54,
    stock: "in-stock",
    collection: "brass-binoculars",
    image: img.binoculars,
    gallery: [img.binoculars, img.binocularsField],
    finish: "Antique brass & leather",
    material: "Brass, leather, optics",
    dimensions: '7.5" × 5.2" × 2.4"',
    weight: "980 g",
    packaging: "Canvas case",
    included: ["Binoculars", "Canvas case", "Lens cloth"],
    description:
      "Full-size decorative binoculars with working focus and a supple leather wrap. A statement piece for libraries and yachts.",
    story: "Leather is hand-stitched; brass is left unlacquered so it will deepen with time.",
    wholesaleFrom: 72,
    moq: 20,
    featured: true,
  },
  {
    slug: "opera-field-glasses",
    name: "Vintage Opera Field Glasses",
    sku: "MM-BIN-003",
    price: 79,
    rating: 4.5,
    reviews: 33,
    stock: "in-stock",
    collection: "brass-binoculars",
    image: img.binocularsField,
    gallery: [img.binocularsField, img.binoculars],
    finish: "Bright brass",
    material: "Brass & mother-of-pearl accents",
    dimensions: '4.1" × 3.6"',
    weight: "310 g",
    packaging: "Velvet box",
    included: ["Field glasses", "Velvet box"],
    description:
      "Compact opera glasses with a mother-of-pearl inlay — a refined gift for evenings ashore.",
    story: "A favourite of hotel shops and nautical retailers.",
    wholesaleFrom: 38,
    moq: 40,
  },
  {
    slug: "maritime-telescope-24",
    name: "Maritime Telescope 24\"",
    sku: "MM-TEL-024",
    price: 159,
    rating: 4.8,
    reviews: 62,
    stock: "in-stock",
    collection: "telescopes",
    badge: "New",
    image: img.telescope,
    gallery: [img.telescope, img.telescopeNight],
    finish: "Antique brass",
    material: "Brass, leather, optics",
    dimensions: '24" extended, 10" closed',
    weight: "1.1 kg",
    packaging: "Wooden crate",
    included: ["Telescope", "Leather wrap", "Stand optional"],
    description:
      "Three-draw spyglass with a leather barrel and antique finish. Looks as authentic on a chart table as it does on a mantel.",
    story: "Draw tubes are hand-fitted so the telescope extends with a quiet, even slide.",
    wholesaleFrom: 86,
    moq: 12,
    featured: true,
  },
  {
    slug: "leather-spyglass",
    name: "Captain’s Leather Spyglass",
    sku: "MM-TEL-010",
    price: 99,
    rating: 4.7,
    reviews: 44,
    stock: "in-stock",
    collection: "telescopes",
    image: img.telescopeNight,
    gallery: [img.telescopeNight, img.telescopeAstro],
    finish: "Dark leather & brass",
    material: "Brass & full-grain leather",
    dimensions: '16" extended',
    weight: "640 g",
    packaging: "Gift tube",
    included: ["Spyglass", "Gift tube"],
    description:
      "A lighter two-draw spyglass for gifting, styled after explorer instruments of the 1890s.",
    story: "Leather is vegetable-tanned and will pick up a captain’s patina.",
    wholesaleFrom: 52,
    moq: 24,
  },
  {
    slug: "decorative-brass-anchor",
    name: "Decorative Brass Anchor",
    sku: "MM-DEC-011",
    price: 49,
    rating: 4.4,
    reviews: 29,
    stock: "in-stock",
    collection: "nautical-decor",
    image: img.rope,
    gallery: [img.rope, img.harbor],
    finish: "Antique brass",
    material: "Solid brass",
    dimensions: '12" H',
    weight: "1.4 kg",
    packaging: "Kraft crate",
    included: ["Anchor", "Wall mount kit"],
    description:
      "A solid brass wall anchor with chain detail — hospitality-ready and substantial in the hand.",
    story: "Cast in small batches, then filed and darkened by hand.",
    wholesaleFrom: 24,
    moq: 30,
  },
  {
    slug: "ship-lantern-brass",
    name: "Ship Lantern in Brass",
    sku: "MM-DEC-019",
    price: 85,
    rating: 4.6,
    reviews: 37,
    stock: "in-stock",
    collection: "nautical-decor",
    image: img.lanternOil,
    gallery: [img.lanternOil, img.lanternVintage, img.lanternCandle],
    finish: "Aged brass & glass",
    material: "Brass, glass",
    dimensions: '11" H × 5" Dia',
    weight: "1.6 kg",
    packaging: "Double box",
    included: ["Lantern", "LED candle insert"],
    description:
      "A bulkhead-style ship lantern that takes a candle or the included LED insert. Hotel corridors love it.",
    story: "Glass is set in a brass cage; the handle is riveted, not glued.",
    wholesaleFrom: 44,
    moq: 16,
    featured: true,
  },
  {
    slug: "porthole-mirror",
    name: "Porthole Wall Mirror",
    sku: "MM-DEC-007",
    price: 95,
    rating: 4.7,
    reviews: 22,
    stock: "in-stock",
    collection: "nautical-decor",
    image: img.lighthouse,
    gallery: [img.lighthouse, img.sailboat],
    finish: "Antique brass",
    material: "Brass & mirrored glass",
    dimensions: '16" Dia',
    weight: "2.8 kg",
    packaging: "Foam crate",
    included: ["Porthole mirror", "Hanging hardware"],
    description:
      "Opening porthole mirror with dog-levers — a classic for yacht clubs and coastal suites.",
    story: "Hinges are real working brass, not stamped décor.",
    wholesaleFrom: 52,
    moq: 10,
  },
  {
    slug: "ship-wheel-24",
    name: "Teak & Brass Ship Wheel 24\"",
    sku: "MM-WHL-024",
    price: 189,
    rating: 4.9,
    reviews: 48,
    stock: "in-stock",
    collection: "ship-wheels",
    badge: "Statement",
    image: img.sail,
    gallery: [img.sail, img.sailboat],
    finish: "Teak & polished brass",
    material: "Teak wood, brass hub",
    dimensions: '24" Dia',
    weight: "4.2 kg",
    packaging: "Wooden crate",
    included: ["Ship wheel", "Wall bracket"],
    description:
      "Eight-spoke teak wheel with a solid brass hub and rim caps. The centrepiece of any nautical wall.",
    story: "Spokes are turned, not CNC-flat. Each wheel is uniquely grained.",
    wholesaleFrom: 110,
    moq: 6,
    featured: true,
  },
  {
    slug: "ship-wheel-36",
    name: "Captain’s Helm 36\"",
    sku: "MM-WHL-036",
    price: 279,
    rating: 5,
    reviews: 18,
    stock: "made-to-order",
    collection: "ship-wheels",
    image: img.ship,
    gallery: [img.ship, img.harbor],
    finish: "Oiled teak & antique brass",
    material: "Teak, brass",
    dimensions: '36" Dia',
    weight: "7.8 kg",
    packaging: "Export crate",
    included: ["Helm", "Floor or wall mount options"],
    description:
      "A full-size decorative helm for lobbies, restaurants and private clubs. Made to order in 12–18 days.",
    story: "Built on the same jigs we use for boutique hotel programmes.",
    wholesaleFrom: 168,
    moq: 4,
  },
  {
    slug: "compass-handle-cane",
    name: "Compass-Handle Walking Cane",
    sku: "MM-CAN-002",
    price: 69,
    rating: 4.6,
    reviews: 57,
    stock: "in-stock",
    collection: "walking-canes",
    image: img.workshop,
    gallery: [img.workshop, img.compassGold],
    finish: "Antique brass on rosewood",
    material: "Rosewood, brass compass",
    dimensions: "36\" L",
    weight: "420 g",
    packaging: "Sleeved gift box",
    included: ["Cane", "Rubber ferrule", "Gift box"],
    description:
      "A gentleman’s cane with a working brass compass set into the handle. A quietly theatrical gift.",
    story: "The compass is sealed against weather; the shaft is oiled rosewood.",
    wholesaleFrom: 32,
    moq: 24,
    featured: true,
  },
  {
    slug: "anchor-handle-cane",
    name: "Anchor-Handle Walking Stick",
    sku: "MM-CAN-006",
    price: 75,
    rating: 4.5,
    reviews: 21,
    stock: "in-stock",
    collection: "walking-canes",
    image: img.antiques2,
    gallery: [img.antiques2, img.workshop],
    finish: "Polished brass",
    material: "Hardwood & brass",
    dimensions: "37\" L",
    weight: "460 g",
    packaging: "Gift box",
    included: ["Walking stick", "Gift box"],
    description:
      "Cast brass anchor handle on a dark hardwood shaft — a favourite of coastal boutiques.",
    story: "Handle is lost-wax cast, then filed until the flukes catch the light.",
    wholesaleFrom: 36,
    moq: 24,
  },
  {
    slug: "brass-sextant",
    name: "Navigational Brass Sextant",
    sku: "MM-INS-004",
    price: 149,
    rating: 4.8,
    reviews: 39,
    stock: "in-stock",
    collection: "nautical-instruments",
    badge: "Collector",
    image: img.compassMap,
    gallery: [img.compassMap, img.magnifier, img.globe],
    finish: "Antique brass",
    material: "Brass, glass optics",
    dimensions: '7.5" arc',
    weight: "890 g",
    packaging: "Wooden instrument box",
    included: ["Sextant", "Wooden box", "Certificate card"],
    description:
      "A display-grade sextant with moving index arm and shades — the instrument every collector asks for.",
    story: "Not a toy: the arc is engraved, the shades flip, the horizon glass is set by hand.",
    wholesaleFrom: 82,
    moq: 10,
    featured: true,
  },
  {
    slug: "brass-hourglass",
    name: "Captain’s Brass Hourglass",
    sku: "MM-INS-009",
    price: 42,
    rating: 4.4,
    reviews: 64,
    stock: "in-stock",
    collection: "nautical-instruments",
    image: img.hourglass,
    gallery: [img.hourglass, img.hourglassSand],
    finish: "Antique brass",
    material: "Brass & glass",
    dimensions: '6.5" H',
    weight: "340 g",
    packaging: "Gift box",
    included: ["Hourglass", "Gift box"],
    description:
      "A 60-second watch glass in a brass cage — desk sculpture that still tells a kind of time.",
    story: "Sand is sieved in the workshop so the fall is even.",
    wholesaleFrom: 19,
    moq: 48,
  },
  {
    slug: "astrolabe-replica",
    name: "Astrolabe Wall Replica",
    sku: "MM-INS-017",
    price: 119,
    rating: 4.9,
    reviews: 16,
    stock: "low",
    collection: "new-arrivals",
    badge: "New",
    image: img.globe,
    gallery: [img.globe, img.map, img.compassBrass],
    finish: "Dark antique brass",
    material: "Solid brass",
    dimensions: '8" Dia',
    weight: "720 g",
    packaging: "Felted box",
    included: ["Astrolabe", "Wall hook", "Story card"],
    description:
      "A wall astrolabe with rotating rete — new this season, limited to 200 pieces.",
    story: "Plate engraving is done on a rose engine, then darkened.",
    wholesaleFrom: 64,
    moq: 12,
    featured: true,
  },
  {
    slug: "ship-bell-brass",
    name: "Ship’s Bell in Brass",
    sku: "MM-DEC-021",
    price: 55,
    rating: 4.5,
    reviews: 34,
    stock: "in-stock",
    collection: "nautical-decor",
    image: img.antiques6,
    gallery: [img.antiques6, img.antiques],
    finish: "Polished brass",
    material: "Solid brass",
    dimensions: '6" Dia',
    weight: "1.05 kg",
    packaging: "Kraft box",
    included: ["Bell", "Wall bracket", "Lanyard"],
    description:
      "A ringing ship’s bell with a clear voice — pubs, clubs and garden gates.",
    story: "Cast, then tuned with a light skim on the lip.",
    wholesaleFrom: 27,
    moq: 20,
  },
  {
    slug: "map-magnifier-brass",
    name: "Chart Magnifier",
    sku: "MM-INS-011",
    price: 35,
    rating: 4.3,
    reviews: 48,
    stock: "in-stock",
    collection: "nautical-instruments",
    image: img.magnifier,
    gallery: [img.magnifier, img.compassMap],
    finish: "Antique brass",
    material: "Brass & optical glass",
    dimensions: '4.5" handle',
    weight: "160 g",
    packaging: "Sleeve",
    included: ["Magnifier", "Sleeve"],
    description:
      "A handheld chart magnifier with a turned brass handle. Small, useful, endlessly giftable.",
    story: "Lens is optical glass, not acrylic.",
    wholesaleFrom: 14,
    moq: 60,
  },
  {
    slug: "diving-helmet-decor",
    name: "Vintage Diving Helmet",
    sku: "MM-DEC-030",
    price: 249,
    rating: 5,
    reviews: 12,
    stock: "made-to-order",
    collection: "nautical-decor",
    badge: "Atelier",
    image: img.diving,
    gallery: [img.diving, img.ocean],
    finish: "Antique brass & copper",
    material: "Brass, copper",
    dimensions: '18" H',
    weight: "8.5 kg",
    packaging: "Export crate",
    included: ["Helmet", "Display stand"],
    description:
      "A full decorative Mark-style diving helmet for lobbies and collector rooms. Made to order.",
    story: "Spun, soldered and riveted in our heavy atelier — not a thin import replica.",
    wholesaleFrom: 155,
    moq: 4,
  },
  {
    slug: "sundial-compass",
    name: "Sundial Pocket Compass",
    sku: "MM-CMP-031",
    price: 64,
    rating: 4.7,
    reviews: 25,
    stock: "in-stock",
    collection: "new-arrivals",
    badge: "New",
    image: img.compassBrass,
    gallery: [img.compassBrass, img.globe],
    finish: "Aged brass",
    material: "Solid brass",
    dimensions: '3" × 3"',
    weight: "250 g",
    packaging: "Gift box",
    included: ["Sundial compass", "Latitude card"],
    description:
      "A folding sundial with a compass in the base — new for this season’s collectors.",
    story: "Gnomon is hinged; a small latitude table is included.",
    wholesaleFrom: 29,
    moq: 40,
  },
  {
    slug: "custom-engraved-compass",
    name: "Custom Engraved Compass",
    sku: "MM-CUS-001",
    price: 49,
    rating: 5,
    reviews: 73,
    stock: "made-to-order",
    collection: "custom-manufacturing",
    badge: "Custom",
    image: img.compassGold,
    gallery: [img.compassGold, img.workshop],
    finish: "Your choice",
    material: "Solid brass",
    dimensions: "As specified",
    weight: "From 180 g",
    packaging: "Your packaging or ours",
    included: ["Sample on request", "Logo proof", "Production"],
    description:
      "Your logo, crest or coordinates engraved on a working compass. The starting point for most of our OEM programmes.",
    story: "Proof in 48 hours. Production from 12 days. From India to the world.",
    wholesaleFrom: 16,
    moq: 50,
  },
];

function withNamedImage(p: Product): Product {
  const image = imageForName(p.name, p.image);
  const rest = (p.gallery || []).filter((g) => g !== image);
  return { ...p, image, gallery: [image, ...rest].slice(0, 4) };
}

export const products: Product[] = [...coreProducts, ...catalogProducts].map(withNamedImage);

export type ShopReview = {
  name: string;
  location: string;
  rating: number;
  title: string;
  body: string;
  product: string;
  productSlug: string;
  date: string;
  reply?: string;
  photo?: string;
  avatarClass: string;
};

export const reviews: ShopReview[] = [
  {
    name: "Audra",
    location: "United States",
    rating: 5,
    title: "Stunning on the deck",
    body: "Beautifully crafted piece and looks beautiful on our 3rd level observation deck. Great quality and stunning telescope.",
    product: "Maritime Telescope 24\"",
    productSlug: "maritime-telescope-24",
    date: "13 Jun, 2026",
    reply:
      "Thank you very much for your kind words! We are happy that it looks so beautiful on your observation deck 😊",
    photo: img.ocean,
    avatarClass: "bg-[#2BB673]",
  },
  {
    name: "Ryan",
    location: "Australia",
    rating: 5,
    title: "Matched the photos",
    body: "The item was good quality and matched the listing photos. Solid brass, well packed, and arrived with tracking.",
    product: "Officer Brass Binoculars",
    productSlug: "officer-brass-binoculars",
    date: "01 Jun, 2026",
    reply: "Thank you Ryan — delighted it arrived in perfect condition. Enjoy the binoculars!",
    avatarClass: "bg-[#2F3A8F]",
  },
  {
    name: "James W.",
    location: "London",
    rating: 5,
    title: "Absolutely beautiful",
    body: "The quality and finish exceeded expectations. Gifted it to my father — he keeps it on his desk.",
    product: "Antique Brass Nautical Compass",
    productSlug: "antique-brass-nautical-compass",
    date: "18 May, 2026",
    reply: "Thank you James. Please give our regards to your father — we love hearing these pieces find a home.",
    photo: img.compassMap,
    avatarClass: "bg-[#C9A84C]",
  },
  {
    name: "Priya S.",
    location: "Mumbai",
    rating: 5,
    title: "Wholesale, sorted",
    body: "We ordered 200 officer brass binoculars for our store. On time, boxed perfectly — still our bestseller.",
    product: "Officer Brass Binoculars",
    productSlug: "officer-brass-binoculars",
    date: "02 Apr, 2026",
    reply: "Thank you Priya. Always a pleasure supplying your store — the next restock is ready whenever you need it.",
    avatarClass: "bg-[#8C4A3A]",
  },
  {
    name: "Marco D.",
    location: "Barcelona",
    rating: 4,
    title: "Hotel programme",
    body: "Used the lanterns and porthole mirrors across 40 rooms. Guests photograph them constantly.",
    product: "Ship Lantern in Brass",
    productSlug: "ship-lantern-brass",
    date: "21 Mar, 2026",
    reply: "Thank you Marco. Wonderful to hear they are photographing well in the rooms.",
    photo: img.lanternVintage,
    avatarClass: "bg-[#1B4B6B]",
  },
];

export function getProduct(slug: string) {
  return products.find((p) => p.slug === slug);
}

export function showsFreeShipping(p: Pick<Product, "freeShipping">): boolean {
  return p.freeShipping !== false;
}

export function getCollection(slug: string) {
  return collections.find((c) => c.slug === slug);
}

export function productsByCollection(slug: string) {
  if (slug === "new-arrivals") {
    return products.filter((p) => p.badge === "New" || p.collection === "new-arrivals");
  }
  return products.filter((p) => p.collection === slug || p.category === slug);
}

export function featuredProducts() {
  return products.filter((p) => p.featured);
}

export function formatPrice(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export const DISCOUNT_PERCENT = 30;
export const B2B_MIN_ORDER_QTY = 20;

export function listPrice(price: number) {
  return Number((price / (1 - DISCOUNT_PERCENT / 100)).toFixed(2));
}

export const trustStats = [
  { label: "Years of craft", value: "16+" },
  { label: "Countries shipped", value: "30+" },
  { label: "B2B partners", value: "50+" },
  { label: "Pieces a year", value: "2K+" },
];
