		public struct CategoryStructure : CodableIdentity {
			public var id: String
			public var name: String
			public var localizedDescription: String?
			public var properties: [String:String]?
			public var parentId: String? = nil
			public var subcategoryIds: [String]? = nil
			public var lastUpdated: Timestamp
			public var source: String = "group"
		}


let root = {
  "public": {
    "latest": {
      "categories": {
      }
    }
  }
}
