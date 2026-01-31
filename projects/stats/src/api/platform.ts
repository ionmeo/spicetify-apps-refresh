import type { getAlbumResponse, GraphQLTopArtist, GraphQLTopTrack } from "../types/graph_ql";
import type { PlaylistResponse, RootlistResponse } from "../../../shared/types/platform";
import type { SpotifyRange } from "../types/spotify";

export const getFullPlaylist = async (uri: string) => {
	const playlist = (await Spicetify.Platform.PlaylistAPI.getPlaylist(uri)) as PlaylistResponse;
	const tracks = playlist.contents.items;
	return tracks;
};

export const getRootlist = async () => {
	const rootlist = (await Spicetify.Platform.RootlistAPI.getContents({ flatten: true })) as RootlistResponse;
	return rootlist.items;
};

export const getAlbumMeta = (uri: string) => {
	return (
		Spicetify.GraphQL.Request(Spicetify.GraphQL.Definitions.getAlbum, {
			uri,
			offset: 0,
			limit: 1,
			locale: Spicetify.Locale.getLocale(),
		}) as Promise<getAlbumResponse>
	).then((res) => res?.data?.albumUnion);
};

export const getAlbumMetas = (uris: string[]) => {
	return Promise.all(uris.map((uri) => getAlbumMeta(uri)));
};

export const queryInLibrary = async (uris: string[]) => {
	return Spicetify.Platform.LibraryAPI.contains(...uris) as Promise<boolean[]>;
};


const convertTimeRange = (range: SpotifyRange): string => {
	switch (range) {
		case "short_term":
			return "SHORT_TERM";
		case "medium_term":
			return "MID_TERM";
		case "long_term":
			return "LONG_TERM";
		default:
			return "MID_TERM";
	}
};

let topContentReady = false;

const initTopContent = async (): Promise<void> => {
	if (topContentReady || Spicetify.GraphQL?.Definitions?.userTopContent) {
		topContentReady = true;
		return;
	}
	try {
		const response = await fetch("https://xpui.app.spotify.com/xpui-routes-profile.js");
		const script = await response.text();

		const match = script.match(/"userTopContent","query","([a-f0-9]{64})"/);
		if (!match) throw new Error("Could not find userTopContent hash");
		Spicetify.GraphQL.Definitions.userTopContent = {
			name: "userTopContent",
			operation: "query",
			sha256Hash: match[1],
			value: null,
		};
		topContentReady = true;
	} catch (error) {
		console.error("stats - Failed to register userTopContent:", error);
	}
};

export const getTopTracksGraphQL = async (range: SpotifyRange): Promise<GraphQLTopTrack[]> => {
	await initTopContent();
	if (!Spicetify.GraphQL?.Definitions?.userTopContent) {
		throw new Error("userTopContent GraphQL definition not available");
	}
	const timeRange = convertTimeRange(range);
	const response = await Spicetify.GraphQL.Request(Spicetify.GraphQL.Definitions.userTopContent, {
		includeTopArtists: false,
		topArtistsInput: {
			offset: 0,
			limit: 0,
			sortBy: "AFFINITY",
			timeRange: "SHORT_TERM",
		},
		includeTopTracks: true,
		topTracksInput: {
			offset: 0,
			limit: 50,
			sortBy: "AFFINITY",
			timeRange,
		},
	});
	const items = response?.data?.me?.profile?.topTracks?.items;
	if (items) return items;
	throw new Error("Invalid GraphQL response structure");
};

export const getTopArtistsGraphQL = async (range: SpotifyRange): Promise<GraphQLTopArtist[]> => {
	await initTopContent();
	if (!Spicetify.GraphQL?.Definitions?.userTopContent) {
		throw new Error("userTopContent GraphQL definition not available");
	}
	const timeRange = convertTimeRange(range);
	const response = await Spicetify.GraphQL.Request(Spicetify.GraphQL.Definitions.userTopContent, {
		includeTopArtists: true,
		topArtistsInput: {
			offset: 0,
			limit: 50,
			sortBy: "AFFINITY",
			timeRange,
		},
		includeTopTracks: false,
		topTracksInput: {
			offset: 0,
			limit: 0,
			sortBy: "AFFINITY",
			timeRange: "SHORT_TERM",
		},
	});
	const items = response?.data?.me?.profile?.topArtists?.items;
	if (items) return items;
	throw new Error("Invalid GraphQL response structure");
};