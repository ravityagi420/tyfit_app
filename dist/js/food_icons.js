function getFoodIcon(food) {
  const name = (food.food_name || "").toLowerCase();
  const category = (food.category || "").toLowerCase();

  const has = (...words) => words.some(w => name.includes(w));

  // Protein / meat / fish
  if (has("chicken")) return "drumstick";
  if (has("egg")) return "egg";
  if (has("fish", "salmon", "tuna", "rohu", "pomfret", "sardine")) return "fish";
  if (has("prawn", "shrimp")) return "shell";
  if (has("mutton", "lamb", "goat", "beef", "pork")) return "beef";
  if (has("sausage", "salami", "ham")) return "sandwich";

  // Dairy
  if (has("milk")) return "milk";
  if (has("yogurt", "curd", "dahi", "skyr", "kefir", "buttermilk", "lassi")) return "cup-soda";
  if (has("cheese", "paneer", "mozzarella", "cheddar", "gouda", "feta", "camembert")) return "circle-dot";
  if (has("butter", "ghee", "cream")) return "badge";

  // Grains / breads
  if (has("rice", "basmati", "poha", "murmura")) return "wheat";
  if (has("wheat", "atta", "maida", "semolina", "sooji", "rava", "dalia")) return "wheat";
  if (has("oats", "muesli", "cornflakes")) return "bowl";
  if (has("quinoa", "barley", "millet", "bajra", "ragi", "jowar", "cornmeal")) return "wheat";
  if (has("bread", "roti", "chapati", "naan", "paratha", "pita", "tortilla", "brötchen", "pretzel", "brezel")) return "sandwich";
  if (has("idli", "dosa", "upma")) return "utensils";

  // Lentils / legumes
  if (has("dal", "lentil", "moong", "masoor", "urad", "toor", "chana", "rajma", "lobia", "soybean", "peas", "beans", "besan", "sattu", "chickpea", "hummus", "edamame")) return "bean";

  // Vegetables
  if (has("potato", "sweet potato", "yam", "arbi", "colocasia")) return "circle";
  if (has("tomato")) return "circle-dot";
  if (has("onion", "garlic")) return "circle";
  if (has("carrot")) return "carrot";
  if (has("cucumber", "zucchini", "bottle gourd", "ridge gourd", "snake gourd", "lauki", "turai")) return "salad";
  if (has("spinach", "palak", "methi", "mustard greens", "sarson", "amaranth", "lettuce", "coriander", "mint", "curry leaves", "moringa")) return "leaf";
  if (has("broccoli", "cauliflower", "cabbage", "brussels", "kohlrabi")) return "flower";
  if (has("capsicum", "pepper", "chilli")) return "flame";
  if (has("okra", "bhindi", "eggplant", "brinjal", "pumpkin", "beetroot", "radish", "turnip", "asparagus", "celery", "mushroom", "corn")) return "salad";

  // Fruits
  if (has("apple")) return "apple";
  if (has("banana", "plantain")) return "banana";
  if (has("orange", "mandarin", "clementine", "lemon")) return "citrus";
  if (has("mango", "papaya", "pineapple", "guava", "pear", "peach", "plum", "kiwi", "grapes", "pomegranate", "watermelon", "muskmelon", "berries", "strawberries", "blueberries", "raspberries", "dates", "raisins", "figs", "coconut", "avocado", "lychee", "dragon fruit", "passion fruit", "jamun", "amla")) return "apple";

  // Nuts / seeds / oils
  if (has("almond", "cashew", "walnut", "peanut", "pistachio", "hazelnut", "macadamia", "brazil nut")) return "nut";
  if (has("seed", "chia", "flax", "sesame", "sunflower", "pumpkin", "hemp")) return "sprout";
  if (has("peanut butter", "almond butter", "tahini")) return "jar";
  if (has("oil", "olive", "mustard oil", "groundnut oil", "sunflower oil", "coconut oil")) return "droplets";

  // Drinks
  if (has("juice", "coconut water", "cola", "soda", "beer", "spritzer")) return "cup-soda";
  if (has("tea", "coffee")) return "coffee";

  // Pantry / sweets / spices
  if (has("sugar", "jaggery", "honey")) return "candy";
  if (has("chocolate", "cocoa")) return "cookie";
  if (has("salt")) return "badge";
  if (has("cumin", "coriander seeds", "turmeric", "chilli powder", "pepper", "cardamom", "cinnamon", "cloves", "mustard seeds", "fenugreek", "fennel", "hing", "asafoetida")) return "sparkles";

  // International / prepared
  if (has("pasta", "couscous", "bulgur")) return "wheat";
  if (has("pizza")) return "pizza";
  if (has("fries", "chips")) return "package";
  if (has("protein bar")) return "badge";

  // Category fallback
  if (category.includes("fruit")) return "apple";
  if (category.includes("vegetable")) return "salad";
  if (category.includes("dairy")) return "milk";
  if (category.includes("meat") || category.includes("fish")) return "drumstick";
  if (category.includes("lentil") || category.includes("legume")) return "bean";
  if (category.includes("grain") || category.includes("bread")) return "wheat";
  if (category.includes("nut") || category.includes("seed")) return "nut";
  if (category.includes("oil") || category.includes("fat")) return "droplets";
  if (category.includes("beverage")) return "cup-soda";

  return "utensils";
}