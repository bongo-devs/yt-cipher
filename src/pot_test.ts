import { assertEquals } from "https://deno.land/std@0.224.0/assert/assert_equals.ts";
import { isSessionBound } from "./pot.ts";

Deno.test("session bound clients mint against visitorData", () => {
  for (
    const client of [
      "IOS",
      "ios",
      "IOS_MUSIC",
      "ANDROID",
      "ANDROID_VR",
      "TV_SIMPLY",
      "TVHTML5",
      "TVHTML5_SIMPLY",
    ]
  ) {
    assertEquals(
      isSessionBound(client),
      true,
      `${client} should be session bound`,
    );
  }
});

Deno.test("content bound clients mint against videoId", () => {
  for (const client of ["WEB", "MWEB", "WEB_REMIX", "", undefined]) {
    assertEquals(
      isSessionBound(client),
      false,
      `${client} should be content bound`,
    );
  }
});
