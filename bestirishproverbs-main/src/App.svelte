
<script>
  import { ProverbStore } from './ProverbStore.js';
;
  import { createEventDispatcher } from 'svelte';
  import Footer from './Footer.svelte';

  const dispatch = createEventDispatcher();

  let selectedMood = '';
  let filteredProverbs = [];

  function filterProverbs() {

    filteredProverbs = ProverbStore.filter(proverb => {
      return selectedMood === '' || proverb.mood === selectedMood;
    });
  }
  let filteredPhrases = [];

  function filterPhrases() {
    filteredProverbs = ProverbStore.filter(proverb => {
      return selectedMood === '' || proverb.mood === selectedMood;
    });
  }
	console.log(ProverbStore);
  $: filterProverbs();

  function handleChange(event) {
    selectedMood = event.target.value;
    dispatch('filterPhrases', selectedMood);
    filterPhrases();
    const cards = document.querySelectorAll('.card'); // Select all the divs with class 'card'
    const min = 240; // Set the minimum color value to 200
  const max = 250; // Set the maximum color value to 240
  const greyValue = Math.floor(Math.random() * (max - min + 1) + min); // Generate a random grey value between 200 and 240
  const randomColor = `rgb(${greyValue}, ${greyValue}, ${greyValue})`; // Use the same value for red, green, and blue channels to create a shade of grey

cards.forEach(card => { // Loop through each card

  card.style.backgroundColor = randomColor; // Set the background color of the card to the random color
  card.style.opacity = 0;
  card.style.animation = 'none'; // Reset the animation
  setTimeout(() => {
    card.style.animation = 'fade-in .5s ease-in-out forwards'; // Apply the animation after a delay
    card.style.opacity = 1;
  }, 100);


});

  }
  import { onMount } from 'svelte';




</script>

<nav>
  <div class="navbar">
    <div class="navbar-element">
      <a href="/"><h3>BestIrishProverbs - All Irish proverbs in one place</h3></a>
    </div>
  </div>
</nav>







<div class="container">

  <h1 href="/">Filter your proverbs by mood.</h1>
<select on:change={handleChange}>
  <option value="">All</option>
	<option value="wise">Wise</option>
	<option value="thoughtful">Thoughtful</option>
	<option value="cautionary">Cautionary</option>
	<option value="serious">Serious</option>
	<option value="instructional">Instructional</option>
	<option value="motivational">Motivational</option>
	<option value="hopeful">Hopeful</option>
	<option value="happy">Happy</option>
	<option value="neutral">Neutral</option>
	<option value="humorous">Humorous</option>
	<option value="warning">Warning</option>
</select>


{#each filteredProverbs as proverb}
  <div class="card">{proverb.text}</div>
{/each}

</div>

<Footer/>





  <style>

    nav {
  background-color: #fff;
  height: 80px;
  display: flex;
  align-items: center;
  }

  .navbar {
  display: flex;
  justify-content: center;
  width: 100%;
  }


  

  nav {
  background-color: #fff;
  height: 80px;
  display: flex;
  align-items: center;
}

.navbar {
  display: flex;
  justify-content: center;
  width: 100%;
}

.navbar-element {
  margin: 0 20px;
}

.navbar-element a {
  text-decoration: none;
  font-size: 18px;
  font-weight: 600;
  color: #333;
  text-align: center;;

}

.navbar-element a:hover {
  color: #3498db;
}
  
  </style>