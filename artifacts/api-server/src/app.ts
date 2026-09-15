import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"],
    allowedHeaders: ["*"],
    exposedHeaders: [
      "Content-Range",
      "Accept-Ranges",
      "Content-Length",
      "Content-Type",
    ],
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root overview / health endpoint for mobile apps and browsers
const apiOverview = (_req: express.Request, res: express.Response) => {
  res.json({
    status: "ok",
    service: "Mavrixfy Music API Server",
    version: "2.0.0",
    docs: "Connected to YouTube Music & Mavrixfy mobile engine",
    endpoints: {
      search: "/api/search?query=:query (or ?q=:query)",
      searchSongs: "/api/search/songs?query=:query&limit=50",
      searchAlbums: "/api/search/albums?query=:query",
      searchArtists: "/api/search/artists?query=:query",
      searchPlaylists: "/api/search/playlists?query=:query",
      songDetails: "/api/songs/:id (or /api/songs?id=:id)",
      songSuggestions: "/api/songs/:id/suggestions?limit=20",
      playlist: "/api/playlists/:id (or /api/playlist/:id)",
      artist: "/api/artists/:id",
      homeModules: "/api/home or /api/modules",
      trending: "/api/trending",
      streamAudio: "/api/stream/:videoId.mp3 (with Range header support)",
      lyrics: "/api/lyrics/:videoId?title=:title&artist=:artist",
    },
  });
};

app.get("/", apiOverview);
app.get("/api", apiOverview);

app.use("/api", router);
app.use(router);

export default app;
