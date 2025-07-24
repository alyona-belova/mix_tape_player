document.addEventListener("DOMContentLoaded", function () {
  const fileInput = document.getElementById("fileInput");
  const playlist = document.getElementById("playlist");
  const audioPlayer = document.getElementById("audio-player");
  const nowPlayingDisplay = document.getElementById("now-playing");
  const modal = document.getElementById("confirm-modal");
  const confirmYes = document.getElementById("confirm-yes");
  const confirmNo = document.getElementById("confirm-no");

  let uploadedTracks = [];
  let currentTrackIndex = -1;
  let pendingDeleteIndex = null;

  fileInput.addEventListener("change", function () {
    const files = Array.from(this.files);
    if (files.length === 0) return;

    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    fetch("http://localhost:8080/upload", {
      method: "POST",
      body: formData,
    })
      .then((res) => res.json())
      .then(() => {
        loadPlaylistFromServer();
      })
      .catch((err) => {
        console.error("Upload failed", err);
      });

    this.value = "";
  });

  function renderPlaylist() {
    playlist.innerHTML = "";
    const fragment = document.createDocumentFragment();
    uploadedTracks.forEach((track, index) => {
      const li = document.createElement("li");
      li.textContent = track.name;
      li.addEventListener("click", () => playTrack(index));

      if (index === currentTrackIndex) {
        li.classList.add("playing");
      }
      fragment.appendChild(li);
    });
    playlist.appendChild(fragment);
  }

  function playTrack(index) {
    if (
      index >= 0 &&
      index < uploadedTracks.length &&
      currentTrackIndex !== index
    ) {
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

  function shufflePlay() {
    fetch("http://localhost:8080/shuffle")
      .then((res) => res.json())
      .then((tracks) => {
        uploadedTracks = tracks.map((track) => ({
          name: track.filename,
          url: `http://localhost:8080${track.path}`,
        }));
        renderPlaylist();

        if (uploadedTracks.length > 0) {
          currentTrackIndex = -1;
          playTrack(0);
        }
      })
      .catch((err) => console.error("Shuffle failed:", err));
  }

  confirmYes.addEventListener("click", () => {
    if (pendingDeleteIndex !== null) {
      const trackToRemove = uploadedTracks[pendingDeleteIndex]; // ✅ Define it here

      fetch(
        `http://localhost:8080/song/${encodeURIComponent(trackToRemove.name)}`,
        {
          method: "DELETE",
        }
      )
        .then((res) => {
          if (!res.ok) {
            throw new Error("Failed to delete from server");
          }

          uploadedTracks.splice(pendingDeleteIndex, 1);

          if (uploadedTracks.length > 0) {
            const next = Math.min(
              pendingDeleteIndex,
              uploadedTracks.length - 1
            );
            playTrack(next);
          } else {
            audioPlayer.src = "";
            nowPlayingDisplay.textContent = "silence...";
            currentTrackIndex = -1;
          }

          renderPlaylist();
        })
        .catch((err) => console.error("Delete failed", err));
    }

    closeModal();
  });

  confirmNo.addEventListener("click", closeModal);

  function openModal(index) {
    pendingDeleteIndex = index;
    modal.classList.remove("hidden");
  }

  function closeModal() {
    pendingDeleteIndex = null;
    modal.classList.add("hidden");
  }

  function loadPlaylistFromServer(shuffle = false) {
    const url = shuffle
      ? "http://localhost:8080/shuffle"
      : "http://localhost:8080/playlist";

    fetch(url)
      .then((res) => res.json())
      .then((tracks) => {
        uploadedTracks = tracks.map((track) => ({
          name: track.filename,
          url: `http://localhost:8080${track.path}`,
        }));
        renderPlaylist();
        if (uploadedTracks.length > 0 && currentTrackIndex === -1) {
          playTrack(0);
        }
      })
      .catch((err) => console.error("Failed to load playlist", err));
  }

  loadPlaylistFromServer();

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
          openModal(currentTrackIndex);
        }
        break;

      case "KeyS":
        shufflePlay();
        break;
    }
  });
});
