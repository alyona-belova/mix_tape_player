package main

import (
	"context"
	"log"
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var (
	mongoClient *mongo.Client
	db          *mongo.Database
)

type Song struct {
	Filename string `bson:"filename" json:"filename"`
	Path     string `bson:"path" json:"path"`
	Uploaded int64  `bson:"uploaded" json:"uploaded"`
}

const collName string = "mix_tape_songs"
const dbName string = "local"

func main() {
	ctx := context.TODO()
	client, err := mongo.Connect(ctx, options.Client().ApplyURI("mongodb://localhost:27017"))
	if err != nil {
		log.Fatal(err)
	}
	mongoClient = client
	db = mongoClient.Database(dbName)

	router := gin.Default()
	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))
	router.Static("/songs", "./uploads")

	router.POST("/upload", handleUpload)
	router.GET("/playlist", getPlaylist)
	router.GET("/shuffle", getShuffledPlaylist)
	router.DELETE("/song/:filename", deleteSong)

	router.Run(":8080")
}

func handleUpload(c *gin.Context) {
	form, err := c.MultipartForm()
	if err != nil {
		c.String(http.StatusBadRequest, "Invalid upload")
		return
	}

	files := form.File["files"]
	songs := []any{}

	for _, file := range files {
		dst := filepath.Join("uploads", filepath.Base(file.Filename))
		if err := c.SaveUploadedFile(file, dst); err != nil {
			continue
		}

		count, err := db.Collection(collName).CountDocuments(context.TODO(), bson.M{"filename": file.Filename})
		if err != nil || count > 0 {
			continue // skip duplicates
		}

		song := Song{
			Filename: file.Filename,
			Path:     "/songs/" + file.Filename,
			Uploaded: time.Now().Unix(),
		}
		songs = append(songs, song)
	}

	if len(songs) > 0 {
		_, err = db.Collection(collName).InsertMany(context.TODO(), songs)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "DB error"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func getPlaylist(c *gin.Context) {
	cursor, err := db.Collection(collName).Find(context.TODO(), bson.M{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "DB error"})
		return
	}
	defer cursor.Close(context.TODO())

	var songs []Song
	if err = cursor.All(context.TODO(), &songs); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Parse error"})
		return
	}

	c.JSON(http.StatusOK, songs)
}

func getShuffledPlaylist(c *gin.Context) {
	cursor, err := db.Collection(collName).Find(context.TODO(), bson.M{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "DB error"})
		return
	}
	defer cursor.Close(context.TODO())

	var songs []Song
	if err = cursor.All(context.TODO(), &songs); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Parse error"})
		return
	}

	rand.Seed(time.Now().UnixNano())
	rand.Shuffle(len(songs), func(i, j int) { songs[i], songs[j] = songs[j], songs[i] })

	c.JSON(http.StatusOK, songs)
}

func deleteSong(c *gin.Context) {
	filename := c.Param("filename")

	// delete from MongoDB
	_, err := db.Collection(collName).DeleteOne(context.TODO(), bson.M{"filename": filename})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete from db"})
		return
	}

	// delete file from uploads folder
	err = os.Remove(filepath.Join("uploads", filename))
	if err != nil {
		log.Println("Failed to delete file from disk:", err)
	}

	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}
