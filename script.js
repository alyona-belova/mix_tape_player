document.addEventListener("DOMContentLoaded", function () {
  const fileInput = document.getElementById("fileInput");
  const playlist = document.getElementById("playlist");
  const audioPlayer = document.getElementById("audio-player");
  const nowPlayingDisplay = document.getElementById("now-playing");

  let uploadedTracks = [];
  let currentTrackIndex = -1;

  fileInput.addEventListener("change", function () {
    const files = Array.from(this.files);
    if (files.length === 0) return;

    files.forEach((file) => {
      const trackName = file.name.replace(/\.[^/.]+$/, "");
      const exists = uploadedTracks.some((track) => track.name === trackName);
      if (!exists) {
        const track = {
          name: trackName,
          url: URL.createObjectURL(file),
        };
        uploadedTracks.push(track);
      } else {
        alert(`"${trackName}" is already in the playlist!`);
      }
    });
    renderPlaylist();

    if (currentTrackIndex === -1 && uploadedTracks.length > 0) {
      playTrack(0);
    }
    this.value = "";
  });

  function renderPlaylist() {
    playlist.innerHTML = "";

    uploadedTracks.forEach((track, index) => {
      const li = document.createElement("li");
      li.textContent = track.name;
      li.addEventListener("click", () => playTrack(index));

      if (index === currentTrackIndex) {
        li.classList.add("playing");
      }

      playlist.appendChild(li);
    });
  }

  function playTrack(index) {
    if (index >= 0 && index < uploadedTracks.length) {
      currentTrackIndex = index;
      const track = uploadedTracks[index];

      audioPlayer.src = track.url;
      audioPlayer
        .play()
        .then(() => {
          nowPlayingDisplay.textContent = `now playing: ${track.name}`;
          renderPlaylist();
        })
        .catch((error) => {
          console.error("error:", error);
        });

      audioPlayer.onended = () => {
        playTrack((currentTrackIndex + 1) % uploadedTracks.length);
      };
    }
  }

  function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
  function shufflePlay() {
    if (uploadedTracks.length <= 1) return;

    const currentTrack = uploadedTracks[currentTrackIndex];
    shuffleArray(uploadedTracks);
    if (currentTrack) {
      currentTrackIndex = uploadedTracks.findIndex(
        (track) => track.name === currentTrack.name
      );
    }
    renderPlaylist();
    playTrack(0);
  }

  // key controls
  document.addEventListener("keydown", (e) => {
    if (uploadedTracks.length === 0) return;

    switch (e.code) {
      case "Space":
        e.preventDefault();
        audioPlayer.paused ? audioPlayer.play() : audioPlayer.pause();
        break;

      case "ArrowRight":
        playTrack((currentTrackIndex + 1) % uploadedTracks.length);
        break;

      case "ArrowLeft":
        playTrack(
          (currentTrackIndex - 1 + uploadedTracks.length) %
            uploadedTracks.length
        );
        break;

      case "KeyD":
        if (currentTrackIndex >= 0) {
          uploadedTracks.splice(currentTrackIndex, 1);
          if (uploadedTracks.length > 0) {
            playTrack(Math.min(currentTrackIndex, uploadedTracks.length - 1));
          } else {
            audioPlayer.src = "";
            nowPlayingDisplay.textContent = "silence...";
            currentTrackIndex = -1;
          }
          renderPlaylist();
        }
        break;

      case "KeyS":
        shufflePlay();
        break;
    }
  });
});
